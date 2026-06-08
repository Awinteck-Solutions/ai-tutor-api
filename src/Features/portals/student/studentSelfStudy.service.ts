import mongoose from "mongoose";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { JwtPayload } from "../../../types/express.d";
import { PROMPTS } from "../../../services/ai/prompt.templates";
import { AIService } from "../../../services/ai/ai.service";
import {
  enqueueJob,
  GenerateFlashcardsJobData,
  GenerateQuizJobData,
  JobType,
} from "../../../services/queue/job.queue";
import { AI_GENERATION_QUEUE } from "../../../services/qdrant/qdrant.constants";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";
import {
  buildPaginationMeta,
  buildTextSearchFilter,
  parsePagination,
} from "../../../shared/utils/pagination";
import Lesson from "../../lesson/models/lesson.model";
import LessonMaterial from "../../lesson/models/lessonMaterial.model";
import Quiz from "../../quiz/models/quiz.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import FlashcardSet from "../../flashcard/models/flashcardSet.model";
import Material from "../../material/models/material.model";
import {
  toMaterialResponse,
  UploadPdfInput,
  UploadTextInput,
  UploadYoutubeInput,
} from "../../material/dto/material.dto";
import { MaterialService } from "../../material/services/material.service";
import { enqueueLessonGeneration } from "../../lesson/services/lessonGeneration.service";
import { getLessonMaterialIds } from "../../../shared/services/content.service";
import { SelfStudyPlacementService } from "../../../shared/services/selfStudyPlacement.service";
import { StudentPlanLimitService } from "../../../shared/services/studentPlanLimit.service";

interface GeneratedLesson {
  title: string;
  summary: string;
  objectives: string[];
  concepts: string[];
  examples: string[];
  references: string[];
  content: string;
}

export class StudentSelfStudyService {
  static async createPersonalLesson(
    user: JwtPayload,
    organizationId: string,
    input: { title?: string; prompt: string }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertLessonCreation(organizationId, user.sub);

    const prompt = input.prompt?.trim();
    if (!prompt || prompt.length < 10) {
      throw new AppError("Describe what you want to learn (at least 10 characters)", 400);
    }

    const placement = await SelfStudyPlacementService.ensureGeneralPlacement(
      organizationId
    );

    const lesson = await Lesson.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      createdBy: new mongoose.Types.ObjectId(user.sub),
      ownerId: new mongoose.Types.ObjectId(user.sub),
      isPersonal: true,
      title: input.title?.trim() || "My lesson",
      topicId: placement.topicId,
      subjectId: placement.subjectId,
      academicYearId: placement.academicYearId,
      generationStatus: ProcessingStatus.PROCESSING,
      status: Status.ACTIVE,
    });

    try {
      const generated = await AIService.generateJSON<GeneratedLesson>(
        PROMPTS.lessonFromPrompt(prompt, input.title)
      );

      lesson.title = generated.title || lesson.title;
      lesson.summary = generated.summary;
      lesson.objectives = generated.objectives ?? [];
      lesson.concepts = generated.concepts ?? [];
      lesson.examples = generated.examples ?? [];
      lesson.references = generated.references ?? [];
      lesson.content = generated.content;
      lesson.generationStatus = ProcessingStatus.COMPLETED;
      await lesson.save();

      return {
        id: lesson._id.toString(),
        title: lesson.title,
        summary: lesson.summary,
        isPersonal: true,
        generationStatus: lesson.generationStatus,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lesson generation failed";
      lesson.generationStatus = ProcessingStatus.FAILED;
      lesson.errorMessage = message;
      await lesson.save();
      throw new AppError(message, 500);
    }
  }

  static async uploadPdf(
    user: JwtPayload,
    organizationId: string,
    input: { title?: string; description?: string },
    file: Express.Multer.File
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertMaterialUpload(
      organizationId,
      user.sub,
      file.size
    );
    const placement = await SelfStudyPlacementService.ensureGeneralPlacement(
      organizationId
    );
    const payload: UploadPdfInput = {
      organizationId,
      topicId: placement.topicId.toString(),
      title: input.title?.trim() || "Uploaded PDF",
      description: input.description,
    };
    return MaterialService.uploadPdf(user, payload, file);
  }

  static async uploadText(
    user: JwtPayload,
    organizationId: string,
    input: { title: string; content: string; description?: string }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertMaterialUpload(
      organizationId,
      user.sub,
      Buffer.byteLength(input.content ?? "", "utf8")
    );
    const placement = await SelfStudyPlacementService.ensureGeneralPlacement(
      organizationId
    );
    const payload: UploadTextInput = {
      organizationId,
      topicId: placement.topicId.toString(),
      title: input.title.trim(),
      content: input.content.trim(),
      description: input.description,
    };
    return MaterialService.uploadText(user, payload);
  }

  static async uploadYoutube(
    user: JwtPayload,
    organizationId: string,
    input: { title: string; youtubeUrl: string; description?: string }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertMaterialUpload(organizationId, user.sub, 0);
    const placement = await SelfStudyPlacementService.ensureGeneralPlacement(
      organizationId
    );
    const payload: UploadYoutubeInput = {
      organizationId,
      topicId: placement.topicId.toString(),
      title: input.title.trim(),
      youtubeUrl: input.youtubeUrl.trim(),
      description: input.description,
    };
    return MaterialService.uploadYoutube(user, payload);
  }

  static async listMyMaterials(
    user: JwtPayload,
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      processingStatus?: string;
    }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      uploadedBy: new mongoose.Types.ObjectId(user.sub),
      status: { $ne: Status.DELETED },
    };

    if (query.processingStatus) {
      filter.processingStatus = query.processingStatus;
    }

    const searchFilter = buildTextSearchFilter(query.search, ["title"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [items, total] = await Promise.all([
      Material.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Material.countDocuments(filter),
    ]);

    return {
      items: items.map(toMaterialResponse),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async createPersonalLessonFromMaterials(
    user: JwtPayload,
    organizationId: string,
    input: { title?: string; materialIds: string[] }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertLessonCreation(organizationId, user.sub);

    const materialIds = input.materialIds ?? [];
    if (materialIds.length === 0) {
      throw new AppError("Select at least one processed material", 400);
    }

    const placement = await SelfStudyPlacementService.ensureGeneralPlacement(
      organizationId
    );
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const materials = await Material.find({
      _id: { $in: materialIds },
      organizationId: orgOid,
      uploadedBy: user.sub,
      status: { $ne: Status.DELETED },
      processingStatus: ProcessingStatus.COMPLETED,
    });

    if (materials.length !== materialIds.length) {
      throw new AppError(
        "All materials must be yours and fully processed before generating a lesson",
        422
      );
    }

    const materialOrder = new Map(
      materialIds.map((id, index) => [id, index])
    );

    const lesson = await Lesson.create({
      organizationId: orgOid,
      topicId: placement.topicId,
      subjectId: placement.subjectId,
      academicYearId: placement.academicYearId,
      createdBy: new mongoose.Types.ObjectId(user.sub),
      ownerId: new mongoose.Types.ObjectId(user.sub),
      isPersonal: true,
      title:
        input.title?.trim() ||
        materials[0].title ||
        "Lesson from my materials",
      generationStatus: ProcessingStatus.PENDING,
      status: Status.ACTIVE,
    });

    await LessonMaterial.insertMany(
      materials.map((m) => ({
        organizationId: orgOid,
        lessonId: lesson._id,
        materialId: m._id,
        order: materialOrder.get(m._id.toString()) ?? 0,
      }))
    );

    try {
      const linkedMaterialIds = await getLessonMaterialIds(lesson._id.toString());
      const jobId = await enqueueLessonGeneration(
        lesson._id.toString(),
        linkedMaterialIds
      );
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

    return {
      id: lesson._id.toString(),
      title: lesson.title,
      isPersonal: true,
      generationStatus: lesson.generationStatus,
    };
  }

  static async deleteSelfStudyMaterial(
    user: JwtPayload,
    organizationId: string,
    materialId: string
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const material = await Material.findOne({
      _id: materialId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      uploadedBy: new mongoose.Types.ObjectId(user.sub),
      status: { $ne: Status.DELETED },
    });

    if (!material) {
      throw new AppError("Material not found or you cannot delete it", 404);
    }

    await MaterialService.delete(user, materialId);

    return { id: materialId, message: "Material deleted" };
  }

  static async addMaterialsToPersonalLesson(
    user: JwtPayload,
    organizationId: string,
    lessonId: string,
    input: { materialIds: string[]; reprocess?: boolean }
  ) {
    const lesson = await this.assertLessonAccess(
      user,
      organizationId,
      lessonId
    );

    if (!lesson.isPersonal || lesson.ownerId?.toString() !== user.sub) {
      throw new AppError("You can only add materials to your own lessons", 403);
    }

    if (
      lesson.generationStatus === ProcessingStatus.PROCESSING ||
      lesson.generationStatus === ProcessingStatus.QUEUED
    ) {
      throw new AppError("Wait until the lesson finishes generating", 422);
    }

    const materialIds = input.materialIds ?? [];
    if (materialIds.length === 0) {
      throw new AppError("Select at least one material to add", 400);
    }

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const userOid = new mongoose.Types.ObjectId(user.sub);
    const materials = await Material.find({
      _id: { $in: materialIds },
      organizationId: orgOid,
      uploadedBy: userOid,
      status: { $ne: Status.DELETED },
      processingStatus: ProcessingStatus.COMPLETED,
    });

    if (materials.length !== materialIds.length) {
      throw new AppError(
        "All materials must be yours and fully processed before adding",
        422
      );
    }

    const existingLinks = await LessonMaterial.find({ lessonId: lesson._id });
    const linkedIds = new Set(
      existingLinks.map((l) => l.materialId.toString())
    );
    const newMaterials = materials.filter(
      (m) => !linkedIds.has(m._id.toString())
    );

    if (newMaterials.length === 0) {
      throw new AppError("These materials are already linked to this lesson", 422);
    }

    const maxOrder = existingLinks.reduce(
      (max, link) => Math.max(max, link.order ?? 0),
      -1
    );

    await LessonMaterial.insertMany(
      newMaterials.map((m, index) => ({
        organizationId: orgOid,
        lessonId: lesson._id,
        materialId: m._id,
        order: maxOrder + 1 + index,
      }))
    );

    const shouldReprocess =
      input.reprocess !== false &&
      (lesson.generationStatus === ProcessingStatus.COMPLETED ||
        lesson.generationStatus === ProcessingStatus.FAILED);

    if (shouldReprocess) {
      const allMaterialIds = await getLessonMaterialIds(lesson._id.toString());

      if (allMaterialIds.length === 0) {
        throw new AppError("Lesson has no source materials to rebuild from", 422);
      }

      const readyCount = await Material.countDocuments({
        _id: { $in: allMaterialIds },
        processingStatus: ProcessingStatus.COMPLETED,
        status: { $ne: Status.DELETED },
      });

      if (readyCount !== allMaterialIds.length) {
        throw new AppError(
          "All source materials must be ready before rebuilding",
          422
        );
      }

      lesson.generationStatus = ProcessingStatus.PENDING;
      lesson.errorMessage = undefined;
      await lesson.save();

      try {
        const jobId = await enqueueLessonGeneration(
          lesson._id.toString(),
          allMaterialIds
        );
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
    }

    return {
      id: lesson._id.toString(),
      title: lesson.title,
      addedMaterialIds: newMaterials.map((m) => m._id.toString()),
      generationStatus: lesson.generationStatus,
      reprocessed: shouldReprocess,
      message: shouldReprocess
        ? "Materials added — lesson rebuild queued"
        : "Materials added to lesson",
    };
  }

  static async generateFlashcards(
    user: JwtPayload,
    organizationId: string,
    lessonId: string,
    options: { count?: number; difficulty?: string; title?: string }
  ) {
    const lesson = await this.assertLessonAccess(
      user,
      organizationId,
      lessonId
    );

    await StudentPlanLimitService.assertPracticeGeneration(
      organizationId,
      user.sub
    );

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new AppError("Lesson must be ready before generating flashcards", 422);
    }

    const count = Math.min(30, Math.max(3, options.count ?? 10));
    const difficulty = options.difficulty ?? "medium";
    const setLabel = `${count} cards · ${difficulty}`;
    const title =
      options.title?.trim() ||
      `${lesson.title} — ${setLabel.charAt(0).toUpperCase() + setLabel.slice(1)}`;

    const set = await FlashcardSet.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title,
      difficulty,
      setLabel,
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
    organizationId: string,
    lessonId: string,
    options: { count?: number; difficulty?: string; title?: string }
  ) {
    const lesson = await this.assertLessonAccess(
      user,
      organizationId,
      lessonId
    );

    await StudentPlanLimitService.assertPracticeGeneration(
      organizationId,
      user.sub
    );

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new AppError("Lesson must be ready before generating a quiz", 422);
    }

    const count = Math.min(25, Math.max(3, options.count ?? 10));
    const difficulty = options.difficulty ?? "medium";
    const setLabel = `${count} questions · ${difficulty}`;
    const title =
      options.title?.trim() ||
      `${lesson.title} — ${setLabel.charAt(0).toUpperCase() + setLabel.slice(1)}`;

    const quiz = await Quiz.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title,
      difficulty,
      setLabel,
      generationStatus: ProcessingStatus.PENDING,
    });

    const jobId = await enqueueJob<GenerateQuizJobData>(
      AI_GENERATION_QUEUE,
      JobType.GENERATE_QUIZ,
      { quizId: quiz._id.toString(), lessonId, count, difficulty }
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

  static async regeneratePersonalLesson(
    user: JwtPayload,
    organizationId: string,
    lessonId: string,
    input?: { prompt?: string }
  ) {
    const lesson = await this.assertLessonAccess(
      user,
      organizationId,
      lessonId
    );

    if (
      lesson.generationStatus === ProcessingStatus.PROCESSING ||
      lesson.generationStatus === ProcessingStatus.QUEUED
    ) {
      throw new AppError("Lesson is already being generated", 422);
    }

    const canReprocess = [
      ProcessingStatus.COMPLETED,
      ProcessingStatus.FAILED,
    ].includes(lesson.generationStatus);

    if (!canReprocess) {
      throw new AppError(
        "Lesson cannot be reprocessed while it is being generated",
        422
      );
    }

    const materialIds = await getLessonMaterialIds(lessonId);

    if (materialIds.length > 0) {
      const readyCount = await Material.countDocuments({
        _id: { $in: materialIds },
        processingStatus: ProcessingStatus.COMPLETED,
        status: { $ne: Status.DELETED },
      });

      if (readyCount !== materialIds.length) {
        throw new AppError(
          "Source materials must finish processing before retrying",
          422
        );
      }

      lesson.generationStatus = ProcessingStatus.PENDING;
      lesson.errorMessage = undefined;
      await lesson.save();

      try {
        const jobId = await enqueueLessonGeneration(
          lesson._id.toString(),
          materialIds
        );
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

      return {
        id: lesson._id.toString(),
        title: lesson.title,
        generationStatus: lesson.generationStatus,
        hasSourceMaterials: true,
        message:
          lesson.generationStatus === ProcessingStatus.QUEUED
            ? "Lesson rebuild queued"
            : "Lesson generation queued",
      };
    }

    const prompt = input?.prompt?.trim();
    if (!prompt || prompt.length < 10) {
      throw new AppError(
        "Describe what you want to learn (at least 10 characters) to retry",
        400
      );
    }

    lesson.generationStatus = ProcessingStatus.PROCESSING;
    lesson.errorMessage = undefined;
    await lesson.save();

    try {
      const generated = await AIService.generateJSON<GeneratedLesson>(
        PROMPTS.lessonFromPrompt(prompt, lesson.title)
      );

      lesson.title = generated.title || lesson.title;
      lesson.summary = generated.summary;
      lesson.objectives = generated.objectives ?? [];
      lesson.concepts = generated.concepts ?? [];
      lesson.examples = generated.examples ?? [];
      lesson.references = generated.references ?? [];
      lesson.content = generated.content;
      lesson.generationStatus = ProcessingStatus.COMPLETED;
      await lesson.save();

      return {
        id: lesson._id.toString(),
        title: lesson.title,
        generationStatus: lesson.generationStatus,
        hasSourceMaterials: false,
        message: "Lesson regenerated successfully",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lesson generation failed";
      lesson.generationStatus = ProcessingStatus.FAILED;
      lesson.errorMessage = message;
      await lesson.save();
      throw new AppError(message, 500);
    }
  }

  static async listPersonalLessons(
    user: JwtPayload,
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      generationStatus?: string;
    } = {}
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      ownerId: new mongoose.Types.ObjectId(user.sub),
      isPersonal: true,
      status: Status.ACTIVE,
    };

    if (query.generationStatus) {
      filter.generationStatus = query.generationStatus;
    }

    const searchFilter = buildTextSearchFilter(query.search, ["title", "summary"]);
    if (searchFilter) Object.assign(filter, searchFilter);

    const [lessons, total] = await Promise.all([
      Lesson.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("title summary generationStatus createdAt errorMessage"),
      Lesson.countDocuments(filter),
    ]);

    return {
      items: lessons.map((l) => ({
        id: l._id.toString(),
        title: l.title,
        summary: l.summary,
        generationStatus: l.generationStatus,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getGenerationStatus(
    user: JwtPayload,
    organizationId: string,
    lessonId: string
  ) {
    const lesson = await this.assertLessonAccess(
      user,
      organizationId,
      lessonId
    );

    const materialIds = await getLessonMaterialIds(lessonId);

    const sourceMaterialDocs =
      materialIds.length > 0
        ? await Material.find({
            _id: { $in: materialIds },
            status: { $ne: Status.DELETED },
          })
        : [];
    const sourceMaterialById = new Map(
      sourceMaterialDocs.map((m) => [m._id.toString(), m])
    );
    const orderedSourceMaterials = materialIds
      .map((id) => sourceMaterialById.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));

    const [flashcardSets, legacyCardCount, quizzes] = await Promise.all([
      FlashcardSet.find({ lessonId: lesson._id, status: Status.ACTIVE }).sort({
        createdAt: -1,
      }),
      Flashcard.countDocuments({
        lessonId: lesson._id,
        flashcardSetId: { $exists: false },
      }),
      Quiz.find({ lessonId: lesson._id, status: Status.ACTIVE }).select(
        "title generationStatus difficulty setLabel questionCount createdAt"
      ),
    ]);

    const sets = flashcardSets.map((s) => ({
      id: s._id.toString(),
      title: s.title,
      setLabel: s.setLabel,
      difficulty: s.difficulty,
      cardCount: s.cardCount,
      generationStatus: s.generationStatus,
      createdAt: s.createdAt,
    }));

    if (legacyCardCount > 0) {
      sets.push({
        id: "legacy",
        title: "Flashcards",
        setLabel: `${legacyCardCount} cards`,
        difficulty: undefined,
        cardCount: legacyCardCount,
        generationStatus: ProcessingStatus.COMPLETED,
        createdAt: new Date(),
      });
    }

    const flashcardCount =
      sets.reduce((sum, s) => sum + (s.cardCount ?? 0), 0) || legacyCardCount;

    return {
      lesson: {
        id: lesson._id.toString(),
        title: lesson.title,
        generationStatus: lesson.generationStatus,
        isPersonal: lesson.isPersonal,
        errorMessage: lesson.errorMessage,
        hasSourceMaterials: materialIds.length > 0,
      },
      sourceMaterials: orderedSourceMaterials.map(toMaterialResponse),
      flashcardCount,
      flashcardSets: sets,
      quizzes: quizzes.map((q) => ({
        id: q._id.toString(),
        title: q.title,
        setLabel: q.setLabel,
        difficulty: q.difficulty,
        questionCount: q.questionCount,
        generationStatus: q.generationStatus,
        createdAt: q.createdAt,
      })),
    };
  }

  private static async assertLessonAccess(
    user: JwtPayload,
    organizationId: string,
    lessonId: string
  ) {
    const lesson = await Lesson.findOne({
      _id: lessonId,
      organizationId,
      status: Status.ACTIVE,
    });

    if (!lesson) throw new AppError("Lesson not found", 404);

    if (lesson.isPersonal && lesson.ownerId?.toString() !== user.sub) {
      throw new AppError("You do not have access to this lesson", 403);
    }

    if (!lesson.isPersonal) {
      const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
        user.sub,
        organizationId
      );
      if (
        subjectIds.length > 0 &&
        lesson.subjectId &&
        !subjectIds.includes(lesson.subjectId.toString())
      ) {
        throw new AppError("You are not enrolled in this lesson's subject", 403);
      }
    }

    return lesson;
  }

}
