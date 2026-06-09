import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { AcademicHierarchyService } from "../../../shared/services/academicHierarchy.service";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import { JwtPayload } from "../../../types/express.d";
import Material from "../../material/models/material.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import FlashcardSet from "../../flashcard/models/flashcardSet.model";
import Quiz from "../../quiz/models/quiz.model";
import QuizQuestion from "../../quiz/models/quizQuestion.model";
import {
  GenerateLessonInput,
  LessonMaterialRef,
  LessonResponse,
  toLessonResponse,
} from "../dto/lesson.dto";
import Lesson from "../models/lesson.model";
import LessonMaterial from "../models/lessonMaterial.model";
import { enqueueLessonGeneration } from "./lessonGeneration.service";
import { getLessonMaterialIds } from "../../../shared/services/content.service";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";
import {
  enqueueJob,
  GenerateFlashcardsJobData,
  GenerateQuizJobData,
  JobType,
} from "../../../services/queue/job.queue";
import { AI_GENERATION_QUEUE } from "../../../services/qdrant/qdrant.constants";

export class LessonService {
  static async generate(
    user: JwtPayload,
    input: GenerateLessonInput
  ): Promise<LessonResponse> {
    if (!user.organizationId) {
      throw new AppError("User must belong to an organization", 403);
    }

    const placement = await AcademicHierarchyService.resolveTopic(
      input.topicId,
      user.organizationId
    );

    await OrganizationAccessService.assertManageAccess(
      user,
      placement.organizationId
    );

    const materials = await Material.find({
      _id: { $in: input.materialIds },
      organizationId: placement.organizationId,
      topicId: placement.topicId,
      status: { $ne: Status.DELETED },
      processingStatus: ProcessingStatus.COMPLETED,
    });

    if (materials.length !== input.materialIds.length) {
      throw new AppError(
        "All materials must belong to the topic and be fully processed",
        422
      );
    }

    const materialOrder = new Map(
      input.materialIds.map((id, index) => [id, index])
    );
    const lesson = await Lesson.create({
      organizationId: placement.organizationId,
      topicId: placement.topicId,
      subjectId: placement.subjectId,
      academicYearId: placement.academicYearId,
      createdBy: user.sub,
      title: input.title ? input.title.trim().length > 0 ? input.title.trim() : materials[0].title : materials[0].title,
      studentLevel: input.studentLevel ?? "intermediate",
      order: input.order ?? 0,
      generationStatus: ProcessingStatus.PENDING,
    });

    await LessonMaterial.insertMany(
      materials.map((m) => ({
        organizationId: placement.organizationId,
        lessonId: lesson._id,
        materialId: m._id,
        order: materialOrder.get(m._id.toString()) ?? 0,
      }))
    );

    try {
      const jobId = await enqueueLessonGeneration(lesson._id.toString());
      lesson.generationStatus = ProcessingStatus.QUEUED;
      lesson.jobId = jobId;
      await lesson.save();
    } catch {
      lesson.generationStatus = ProcessingStatus.FAILED;
      lesson.errorMessage =
        "Failed to queue lesson generation. Ensure Redis is running.";
      await lesson.save();
      throw new AppError("Generation queue unavailable", 503);
    }

    const materialRefs = await this.loadLessonMaterials(lesson._id.toString());
    return toLessonResponse(lesson, materialRefs, {
      topicId: placement.topicId,
      subjectId: placement.subjectId,
      academicYearId: placement.academicYearId,
    });
  }

  static async list(
    user: JwtPayload,
    query: {
      organizationId: string;
      topicId?: string;
      subjectId?: string;
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    await OrganizationAccessService.assertReadAccess(user, query.organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId: query.organizationId,
      status: { $ne: Status.DELETED },
      isPersonal: { $ne: true },
    };

    if (query.topicId) filter.topicId = query.topicId;
    if (query.subjectId) filter.subjectId = query.subjectId;

    const searchFilter = buildTextSearchFilter(query.search, ["title"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const subjectScope = await EnrollmentScopeService.resolveSubjectScope(
      user,
      query.organizationId
    );
    if (subjectScope !== null && !query.subjectId) {
      EnrollmentScopeService.applySubjectFilter(filter, subjectScope);
    }

    const [items, total] = await Promise.all([
      Lesson.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
      Lesson.countDocuments(filter),
    ]);

    const lessonIds = items.map((lesson) => lesson._id);
    const [flashcardCounts, quizzes] = await Promise.all([
      Flashcard.aggregate([
        {
          $match: {
            lessonId: { $in: lessonIds },
            status: { $ne: Status.DELETED },
          },
        },
        { $group: { _id: "$lessonId", count: { $sum: 1 } } },
      ]),
      Quiz.find({
        lessonId: { $in: lessonIds },
        status: { $ne: Status.DELETED },
      }).select("lessonId questionCount generationStatus"),
    ]);

    const flashcardCountMap = new Map(
      flashcardCounts.map((row) => [row._id.toString(), row.count as number])
    );
    const quizMap = new Map(
      quizzes.map((quiz) => [quiz.lessonId.toString(), quiz])
    );

    const responses = await Promise.all(
      items.map(async (lesson) => {
        const lessonId = lesson._id.toString();
        const [materials, placement] = await Promise.all([
          this.loadLessonMaterials(lessonId),
          this.resolveLessonPlacement(lesson),
        ]);
        const quiz = quizMap.get(lessonId);
        return toLessonResponse(lesson, materials, placement, {
          flashcardCount: flashcardCountMap.get(lessonId) ?? 0,
          quizQuestionCount: quiz?.questionCount ?? 0,
          quizGenerationStatus: quiz?.generationStatus ?? null,
        });
      })
    );

    return {
      items: responses,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getSources(user: JwtPayload, lessonId: string) {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );
    const materials = await this.loadLessonMaterials(lessonId);
    return {
      lessonId,
      materials: materials.map((m) => ({
        materialId: m.id,
        materialName: m.title,
        type: m.type,
        order: m.order,
      })),
    };
  }

  static async getById(
    user: JwtPayload,
    lessonId: string
  ): Promise<LessonResponse> {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );
    const [materials, placement, flashcardCount, quiz] = await Promise.all([
      this.loadLessonMaterials(lessonId),
      this.resolveLessonPlacement(lesson),
      Flashcard.countDocuments({
        lessonId: lesson._id,
        status: { $ne: Status.DELETED },
      }),
      Quiz.findOne({
        lessonId: lesson._id,
        status: { $ne: Status.DELETED },
      }).select("questionCount generationStatus"),
    ]);
    return toLessonResponse(lesson, materials, placement, {
      flashcardCount,
      quizQuestionCount: quiz?.questionCount ?? 0,
      quizGenerationStatus: quiz?.generationStatus ?? null,
    });
  }

  static async regenerate(
    user: JwtPayload,
    lessonId: string,
    input?: { studentLevel?: "beginner" | "intermediate" | "advanced" }
  ): Promise<LessonResponse> {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertManageAccess(
      user,
      lesson.organizationId.toString()
    );

    if (lesson.generationStatus === ProcessingStatus.PROCESSING) {
      throw new AppError("Lesson is already being generated", 422);
    }

    await this.assertLessonMaterialsReady(lesson._id.toString());

    if (input?.studentLevel) {
      lesson.studentLevel = input.studentLevel;
    }

    lesson.generationStatus = ProcessingStatus.PENDING;
    lesson.errorMessage = undefined;
    await lesson.save();

    const jobId = await enqueueLessonGeneration(lesson._id.toString());
    lesson.generationStatus = ProcessingStatus.QUEUED;
    lesson.jobId = jobId;
    await lesson.save();

    const [materials, placement] = await Promise.all([
      this.loadLessonMaterials(lessonId),
      this.resolveLessonPlacement(lesson),
    ]);
    return toLessonResponse(lesson, materials, placement);
  }

  static async delete(user: JwtPayload, lessonId: string): Promise<void> {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertManageAccess(
      user,
      lesson.organizationId.toString()
    );

    const quizzes = await Quiz.find({ lessonId: lesson._id });
    for (const quiz of quizzes) {
      await QuizQuestion.deleteMany({ quizId: quiz._id });
      quiz.status = Status.DELETED;
      await quiz.save();
    }

    const flashcardSets = await FlashcardSet.find({ lessonId: lesson._id });
    for (const set of flashcardSets) {
      await Flashcard.deleteMany({ flashcardSetId: set._id });
      set.status = Status.DELETED;
      await set.save();
    }
    await Flashcard.deleteMany({ lessonId: lesson._id });
    await LessonMaterial.deleteMany({ lessonId: lesson._id });
    lesson.status = Status.DELETED;
    await lesson.save();
  }

  static async generateFlashcards(
    user: JwtPayload,
    lessonId: string
  ): Promise<{ message: string; jobId: string; flashcardSetId: string }> {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertManageAccess(
      user,
      lesson.organizationId.toString()
    );

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new AppError("Lesson must be completed first", 422);
    }

    const count = 10;
    const difficulty = "medium";
    const set = await FlashcardSet.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title: `${lesson.title} Flashcards`,
      setLabel: `${count} cards · ${difficulty}`,
      difficulty,
      generationStatus: ProcessingStatus.PENDING,
    });

    const jobId = await enqueueJob<GenerateFlashcardsJobData>(
      AI_GENERATION_QUEUE,
      JobType.GENERATE_FLASHCARDS,
      {
        flashcardSetId: set._id.toString(),
        lessonId,
        count,
        difficulty,
      }
    );

    set.generationStatus = ProcessingStatus.QUEUED;
    set.jobId = jobId;
    await set.save();

    return {
      message: "Flashcard generation queued",
      jobId,
      flashcardSetId: set._id.toString(),
    };
  }

  static async generateQuiz(
    user: JwtPayload,
    lessonId: string
  ): Promise<{ message: string; jobId: string; quizId: string }> {
    const lesson = await this.findOrFail(lessonId);
    await OrganizationAccessService.assertManageAccess(
      user,
      lesson.organizationId.toString()
    );

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new AppError("Lesson must be completed first", 422);
    }

    const quiz = await Quiz.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title: `${lesson.title} Quiz`,
      generationStatus: ProcessingStatus.PENDING,
    });

    const jobId = await enqueueJob<GenerateQuizJobData>(
      AI_GENERATION_QUEUE,
      JobType.GENERATE_QUIZ,
      { quizId: quiz._id.toString(), lessonId }
    );

    quiz.generationStatus = ProcessingStatus.QUEUED;
    quiz.jobId = jobId;
    await quiz.save();

    return {
      message: "Quiz generation queued",
      jobId,
      quizId: quiz._id.toString(),
    };
  }

  private static async resolveLessonPlacement(lesson: InstanceType<typeof Lesson>) {
    if (lesson.topicId && lesson.subjectId && lesson.academicYearId) {
      return {
        topicId: lesson.topicId.toString(),
        subjectId: lesson.subjectId.toString(),
        academicYearId: lesson.academicYearId.toString(),
      };
    }

    const link = await LessonMaterial.findOne({ lessonId: lesson._id }).sort({
      order: 1,
    });
    const materialId = link?.materialId ?? lesson.materialId;
    if (!materialId) {
      return { topicId: "", subjectId: "", academicYearId: "" };
    }

    const material = await Material.findById(materialId).select(
      "topicId subjectId academicYearId"
    );

    return {
      topicId: material?.topicId?.toString() ?? "",
      subjectId: material?.subjectId?.toString() ?? "",
      academicYearId: material?.academicYearId?.toString() ?? "",
    };
  }

  private static async assertLessonMaterialsReady(lessonId: string): Promise<void> {
    const materialIds = await getLessonMaterialIds(lessonId);

    if (materialIds.length === 0) {
      throw new AppError("Lesson has no source materials", 422);
    }

    const readyCount = await Material.countDocuments({
      _id: { $in: materialIds },
      processingStatus: ProcessingStatus.COMPLETED,
      status: { $ne: Status.DELETED },
    });

    if (readyCount !== materialIds.length) {
      throw new AppError(
        "All source materials must be fully processed before generation",
        422
      );
    }
  }

  private static async loadLessonMaterials(
    lessonId: string
  ): Promise<LessonMaterialRef[]> {
    const links = await LessonMaterial.find({ lessonId }).sort({ order: 1 });
    if (links.length === 0) {
      const lesson = await Lesson.findById(lessonId).select("materialId");
      if (!lesson?.materialId) return [];

      const material = await Material.findById(lesson.materialId);
      if (!material) return [];

      return [
        {
          id: material._id.toString(),
          title: material.title,
          type: material.type,
          order: 0,
        },
      ];
    }

    const materials = await Material.find({
      _id: { $in: links.map((l) => l.materialId) },
    });
    const byId = new Map(materials.map((m) => [m._id.toString(), m]));

    return links.map((link) => {
      const material = byId.get(link.materialId.toString());
      return {
        id: link.materialId.toString(),
        title: material?.title ?? "Unknown",
        type: material?.type ?? "TEXT",
        order: link.order,
      };
    });
  }

  private static async findOrFail(lessonId: string) {
    const lesson = await Lesson.findOne({
      _id: lessonId,
      status: { $ne: Status.DELETED },
    });
    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }
    return lesson;
  }
}
