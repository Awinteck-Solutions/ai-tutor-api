import mongoose from "mongoose";
import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { JwtPayload } from "../../../types/express.d";
import User from "../../auth/models/user.model";
import Subject from "../../academic/models/subject.model";
import Topic from "../../academic/models/topic.model";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import LessonMaterial from "../../lesson/models/lessonMaterial.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import Quiz from "../../quiz/models/quiz.model";
import LessonProgress from "../../progress/models/lessonProgress.model";
import QuizAttempt from "../../progress/models/quizAttempt.model";
import CourseEnrollment from "../../academic/models/courseEnrollment.model";
import StudentProgress from "../../progress/models/studentProgress.model";
import FlashcardReview from "../../progress/models/flashcardReview.model";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";
import { TeachingOverviewService } from "../../../shared/services/teachingOverview.service";

export class TeacherPortalService {
  static async getDashboard(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const subjectFilter = await this.teacherSubjectFilter(user, organizationId);
    const scopeFilter = this.scopeToMongoFilter(subjectFilter, organizationId);
    const subjectDocFilter = this.scopeToSubjectDocumentFilter(
      subjectFilter,
      organizationId
    );

    if (subjectFilter.subjectIds?.length === 0) {
      return {
        totalStudents: 0,
        totalSubjects: 0,
        totalTopics: 0,
        totalLessons: 0,
        totalMaterials: 0,
        totalQuizzes: 0,
        totalFlashcards: 0,
        completionRate: 0,
        averageScore: 0,
        contentBySubject: [],
        recentActivity: [],
        atRiskStudents: [],
        focusLessons: [],
      };
    }

    const [
      totalStudents,
      totalSubjects,
      totalTopics,
      totalLessons,
      totalMaterials,
      totalQuizzes,
      totalFlashcards,
      quizAgg,
      lessonProgressAgg,
    ] = await Promise.all([
      User.countDocuments({ organizationId: orgOid, role: Role.STUDENT, status: Status.ACTIVE }),
      Subject.countDocuments({ ...subjectDocFilter, status: Status.ACTIVE }),
      Topic.countDocuments({ ...scopeFilter, status: Status.ACTIVE }),
      Lesson.countDocuments({ ...scopeFilter, status: Status.ACTIVE }),
      Material.countDocuments({ ...scopeFilter, status: Status.ACTIVE }),
      Quiz.countDocuments({ organizationId: orgOid, status: Status.ACTIVE }),
      Flashcard.countDocuments({ organizationId: orgOid, status: Status.ACTIVE }),
      QuizAttempt.aggregate([
        { $match: { organizationId: orgOid } },
        { $group: { _id: null, avgScore: { $avg: "$score" }, count: { $sum: 1 } } },
      ]),
      LessonProgress.aggregate([
        { $match: { organizationId: orgOid } },
        {
          $group: {
            _id: null,
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const lp = lessonProgressAgg[0];
    const completionRate =
      lp && lp.total > 0 ? Math.round((lp.completed / lp.total) * 100) : 0;

    const overview = await TeachingOverviewService.build(organizationId, {
      lessonFilter: scopeFilter,
      subjectFilter: subjectDocFilter,
    });

    return {
      totalStudents,
      totalSubjects,
      totalTopics,
      totalLessons,
      totalMaterials,
      totalQuizzes,
      totalFlashcards,
      completionRate,
      averageScore: Math.round(quizAgg[0]?.avgScore ?? 0),
      ...overview,
    };
  }

  static async listSubjects(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const scope = await this.teacherSubjectFilter(user, organizationId);
    if (scope.subjectIds?.length === 0) return [];

    const subjectDocFilter = this.scopeToSubjectDocumentFilter(scope, organizationId);
    const subjects = await Subject.find({ ...subjectDocFilter, status: Status.ACTIVE }).sort({
      order: 1,
      name: 1,
    });
    const subjectIds = subjects.map((s) => s._id);
    const enrollmentCounts = await CourseEnrollment.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          subjectId: { $in: subjectIds },
          status: Status.ACTIVE,
        },
      },
      { $group: { _id: "$subjectId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      enrollmentCounts.map((e) => [e._id.toString(), e.count as number])
    );

    return subjects.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code,
      academicYearId: s.academicYearId.toString(),
      topicCount: 0,
      enrolledStudentCount: countMap.get(s._id.toString()) ?? 0,
    }));
  }

  static async listTopics(
    user: JwtPayload,
    organizationId: string,
    subjectId?: string
  ) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const filter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
    };
    if (subjectId) filter.subjectId = subjectId;

    const topics = await Topic.find(filter).sort({ order: 1, name: 1 });
    return topics.map((t) => ({
      id: t._id.toString(),
      subjectId: t.subjectId.toString(),
      name: t.name,
      description: t.description,
      order: t.order,
    }));
  }

  static async listLessons(
    user: JwtPayload,
    organizationId: string,
    query: { subjectId?: string; topicId?: string }
  ) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const filter: Record<string, unknown> = {
      organizationId,
      status: { $ne: Status.DELETED },
    };
    if (query.topicId) filter.topicId = query.topicId;
    if (query.subjectId) filter.subjectId = query.subjectId;

    const subjectScope = await EnrollmentScopeService.resolveSubjectScope(
      user,
      organizationId
    );
    if (subjectScope !== null && !query.subjectId) {
      EnrollmentScopeService.applySubjectFilter(filter, subjectScope);
    }

    const lessons = await Lesson.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .limit(100);

    const lessonIds = lessons.map((l) => l._id);
    const [flashcardCounts, quizCounts, progressStats] = await Promise.all([
      Flashcard.aggregate([
        { $match: { lessonId: { $in: lessonIds }, status: Status.ACTIVE } },
        { $group: { _id: "$lessonId", count: { $sum: 1 } } },
      ]),
      Quiz.aggregate([
        { $match: { lessonId: { $in: lessonIds }, status: Status.ACTIVE } },
        { $group: { _id: "$lessonId", count: { $sum: 1 } } },
      ]),
      LessonProgress.aggregate([
        { $match: { lessonId: { $in: lessonIds } } },
        {
          $group: {
            _id: "$lessonId",
            avgProgress: { $avg: "$progressPercent" },
            completedCount: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            studentCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const fcMap = new Map(flashcardCounts.map((r) => [r._id.toString(), r.count]));
    const qMap = new Map(quizCounts.map((r) => [r._id.toString(), r.count]));
    const pMap = new Map(progressStats.map((r) => [r._id.toString(), r]));

    return lessons.map((l) => {
      const p = pMap.get(l._id.toString());
      return {
        id: l._id.toString(),
        title: l.title,
        topicId: l.topicId?.toString() ?? "",
        subjectId: l.subjectId?.toString() ?? "",
        generationStatus: l.generationStatus,
        flashcardCount: fcMap.get(l._id.toString()) ?? 0,
        quizCount: qMap.get(l._id.toString()) ?? 0,
        completionMetrics: {
          avgProgress: Math.round(p?.avgProgress ?? 0),
          completedCount: p?.completedCount ?? 0,
          studentCount: p?.studentCount ?? 0,
        },
      };
    });
  }

  static async listMaterials(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const filter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
    };
    const subjectScope = await EnrollmentScopeService.resolveSubjectScope(
      user,
      organizationId
    );
    if (subjectScope !== null) {
      EnrollmentScopeService.applySubjectFilter(filter, subjectScope);
    }

    const materials = await Material.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .select("title type processingStatus processingStage chunkCount createdAt topicId");

    const materialIds = materials.map((m) => m._id);
    const lessonLinks = await LessonMaterial.find({
      materialId: { $in: materialIds },
    }).select("materialId lessonId");

    const lessonsPerMaterial = new Map<string, number>();
    for (const link of lessonLinks) {
      const key = link.materialId.toString();
      lessonsPerMaterial.set(key, (lessonsPerMaterial.get(key) ?? 0) + 1);
    }

    return materials.map((m) => ({
      id: m._id.toString(),
      title: m.title,
      type: m.type,
      processingStatus: m.processingStatus,
      processingStage: m.processingStage,
      chunkCount: m.chunkCount,
      uploadDate: m.createdAt,
      topicId: m.topicId?.toString() ?? "",
      generatedAssets: {
        lessonsUsingMaterial: lessonsPerMaterial.get(m._id.toString()) ?? 0,
        indexed: m.processingStatus === ProcessingStatus.COMPLETED,
      },
    }));
  }

  static async listStudents(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgManage(user, organizationId);
    const students = await User.find({
      organizationId,
      role: Role.STUDENT,
      status: Status.ACTIVE,
    })
      .select("firstName lastName email createdAt")
      .limit(200);

    const studentIds = students.map((s) => s._id);
    const [progressList, enrollmentCounts] = await Promise.all([
      StudentProgress.find({
        userId: { $in: studentIds },
        organizationId,
      }),
      CourseEnrollment.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            studentId: { $in: studentIds },
            status: Status.ACTIVE,
          },
        },
        { $group: { _id: "$studentId", count: { $sum: 1 } } },
      ]),
    ]);

    const progressMap = new Map(
      progressList.map((p) => [p.userId.toString(), p])
    );
    const enrollmentMap = new Map(
      enrollmentCounts.map((e) => [e._id.toString(), e.count as number])
    );

    return students.map((s) => {
      const p = progressMap.get(s._id.toString());
      return {
        id: s._id.toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        enrolledSubjectCount: enrollmentMap.get(s._id.toString()) ?? 0,
        progress: {
          lessonsCompleted: p?.lessonsCompleted ?? 0,
          averageQuizScore:
            p && p.quizzesTaken > 0
              ? Math.round(p.totalQuizScore / p.quizzesTaken)
              : 0,
          studyTimeMinutes: p?.totalStudyTimeMinutes ?? 0,
          currentStreak: p?.currentStreak ?? 0,
        },
      };
    });
  }

  static async getStudent(
    user: JwtPayload,
    organizationId: string,
    studentId: string
  ) {
    await AccessControlService.canAccessStudentData(user, studentId, organizationId);

    const student = await User.findOne({
      _id: studentId,
      organizationId,
      role: Role.STUDENT,
    });
    if (!student) throw new AppError("Student not found", 404);

    const [progress, lessonProgress, recentAttempts, recentReviews, enrollments] =
      await Promise.all([
        StudentProgress.findOne({ userId: studentId, organizationId }),
        LessonProgress.find({ userId: studentId, organizationId })
          .sort({ lastAccessedAt: -1 })
          .limit(20),
        QuizAttempt.find({ userId: studentId, organizationId })
          .sort({ completedAt: -1 })
          .limit(10),
        FlashcardReview.find({ userId: studentId, organizationId })
          .sort({ reviewedAt: -1 })
          .limit(10),
        CourseEnrollment.find({
          studentId,
          organizationId,
          status: Status.ACTIVE,
        }).populate("subjectId", "name code"),
      ]);

    const lessonIds = [
      ...new Set([
        ...lessonProgress.map((lp) => lp.lessonId.toString()),
        ...recentAttempts.map((a) => a.lessonId.toString()),
      ]),
    ];
    const lessonDocs = await Lesson.find({ _id: { $in: lessonIds } }).select(
      "title"
    );
    const lessonTitleMap = new Map(
      lessonDocs.map((l) => [l._id.toString(), l.title])
    );

    const enrolledSubjects = enrollments.map((e) => {
      const subject = e.subjectId as unknown as {
        _id: { toString(): string };
        name: string;
        code?: string;
      };
      return {
        subjectId: subject?._id?.toString?.() ?? e.subjectId.toString(),
        name: subject?.name ?? "Subject",
        code: subject?.code,
      };
    });

    return {
      id: student._id.toString(),
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      progress: {
        lessonsCompleted: progress?.lessonsCompleted ?? 0,
        quizzesTaken: progress?.quizzesTaken ?? 0,
        averageQuizScore:
          progress && progress.quizzesTaken > 0
            ? Math.round(progress.totalQuizScore / progress.quizzesTaken)
            : 0,
        flashcardAccuracy:
          progress && progress.flashcardsReviewed > 0
            ? Math.round(
                (progress.flashcardsCorrect / progress.flashcardsReviewed) * 100
              )
            : 0,
        studyTimeMinutes: progress?.totalStudyTimeMinutes ?? 0,
        currentStreak: progress?.currentStreak ?? 0,
        weakTopics: progress?.weakTopics ?? [],
      },
      enrolledSubjects,
      enrolledSubjectCount: enrolledSubjects.length,
      lessonProgress: lessonProgress.map((lp) => ({
        lessonId: lp.lessonId.toString(),
        lessonTitle: lessonTitleMap.get(lp.lessonId.toString()) ?? "Lesson",
        status: lp.status,
        progressPercent: lp.progressPercent,
        lastAccessedAt: lp.lastAccessedAt,
      })),
      recentActivity: {
        quizAttempts: recentAttempts.map((a) => ({
          quizId: a.quizId.toString(),
          lessonId: a.lessonId.toString(),
          lessonTitle: lessonTitleMap.get(a.lessonId.toString()) ?? "Lesson",
          score: a.score,
          completedAt: a.completedAt,
        })),
        flashcardReviews: recentReviews,
      },
      quizPerformance: recentAttempts.map((a) => ({
        lessonId: a.lessonId.toString(),
        lessonTitle: lessonTitleMap.get(a.lessonId.toString()) ?? "Lesson",
        score: a.score,
        completedAt: a.completedAt,
      })),
    };
  }

  /** Topics, lessons, materials — documents that reference a subject via `subjectId`. */
  private static scopeToMongoFilter(
    scope: {
      organizationId: string;
      subjectId?: mongoose.Types.ObjectId;
      subjectIds?: mongoose.Types.ObjectId[];
    },
    organizationId: string
  ): Record<string, unknown> {
    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const filter: Record<string, unknown> = { organizationId: orgOid };
    if (scope.subjectId) {
      filter.subjectId = scope.subjectId;
    } else if (scope.subjectIds && scope.subjectIds.length > 0) {
      filter.subjectId = { $in: scope.subjectIds };
    }
    return filter;
  }

  /** Subject collection — filter by document `_id`, not `subjectId`. */
  private static scopeToSubjectDocumentFilter(
    scope: {
      organizationId: string;
      subjectId?: mongoose.Types.ObjectId;
      subjectIds?: mongoose.Types.ObjectId[];
    },
    organizationId: string
  ): Record<string, unknown> {
    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const filter: Record<string, unknown> = { organizationId: orgOid };
    if (scope.subjectId) {
      filter._id = scope.subjectId;
    } else if (scope.subjectIds && scope.subjectIds.length > 0) {
      filter._id = { $in: scope.subjectIds };
    }
    return filter;
  }

  private static async teacherSubjectFilter(
    user: JwtPayload,
    organizationId: string
  ): Promise<{
    organizationId: string;
    status: Status;
    subjectId?: mongoose.Types.ObjectId;
    subjectIds?: mongoose.Types.ObjectId[];
  }> {
    const base = { organizationId, status: Status.ACTIVE };
    if ([Role.SCHOOL_ADMIN, Role.SUPER_ADMIN].includes(user.role)) {
      return base;
    }

    const assignedIds = await EnrollmentScopeService.getTeacherSubjectIds(
      user.sub,
      organizationId
    );

    if (assignedIds.length === 0) {
      return { ...base, subjectIds: [] };
    }
    if (assignedIds.length === 1) {
      return {
        ...base,
        subjectId: new mongoose.Types.ObjectId(assignedIds[0]),
      };
    }
    return {
      ...base,
      subjectIds: assignedIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }
}
