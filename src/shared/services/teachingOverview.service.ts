import mongoose from "mongoose";
import { SELF_STUDY_SUBJECT_CODE } from "../constants/selfStudy.constants";
import { ProcessingStatus } from "../enums/processingStatus.enum";
import { LessonProgressStatus } from "../enums/progress.enum";
import { Role } from "../enums/roles.enum";
import { Status } from "../enums/status.enum";
import User from "../../Features/auth/models/user.model";
import Subject from "../../Features/academic/models/subject.model";
import Lesson from "../../Features/lesson/models/lesson.model";
import LessonProgress from "../../Features/progress/models/lessonProgress.model";
import Flashcard from "../../Features/flashcard/models/flashcard.model";
import Quiz from "../../Features/quiz/models/quiz.model";
import StudentProgress from "../../Features/progress/models/studentProgress.model";

export type TeachingOverviewFilters = {
  lessonFilter?: Record<string, unknown>;
  subjectFilter?: Record<string, unknown>;
};

export class TeachingOverviewService {
  static async build(
    organizationId: string,
    filters: TeachingOverviewFilters = {}
  ) {
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const subjectQuery: Record<string, unknown> = {
      organizationId: orgOid,
      status: Status.ACTIVE,
      code: { $ne: SELF_STUDY_SUBJECT_CODE },
      ...filters.subjectFilter,
    };

    const lessonQuery: Record<string, unknown> = {
      organizationId: orgOid,
      status: Status.ACTIVE,
      isPersonal: { $ne: true },
      generationStatus: ProcessingStatus.COMPLETED,
      ...filters.lessonFilter,
    };

    const [subjects, lessons, recentProgress, atRiskProgress, difficultLessons] =
      await Promise.all([
        Subject.find(subjectQuery).sort({ order: 1, name: 1 }).select("name code"),
        Lesson.find(lessonQuery)
          .sort({ order: 1, createdAt: -1 })
          .limit(120)
          .select("title subjectId generationStatus"),
        LessonProgress.find({
          organizationId: orgOid,
          status: { $ne: LessonProgressStatus.COMPLETED },
        })
          .sort({ lastAccessedAt: -1 })
          .limit(10),
        StudentProgress.find({
          organizationId: orgOid,
          quizzesTaken: { $gt: 0 },
        }).limit(50),
        LessonProgress.aggregate([
          { $match: { organizationId: orgOid } },
          {
            $group: {
              _id: "$lessonId",
              avgProgress: { $avg: "$progressPercent" },
              studentCount: { $sum: 1 },
            },
          },
          { $match: { avgProgress: { $lt: 50 }, studentCount: { $gte: 1 } } },
          { $sort: { avgProgress: 1 } },
          { $limit: 5 },
        ]),
      ]);

    const lessonIds = lessons.map((l) => l._id);
    const [flashcardCounts, quizCounts, progressByLesson] = await Promise.all([
      lessonIds.length
        ? Flashcard.aggregate([
            { $match: { lessonId: { $in: lessonIds }, status: Status.ACTIVE } },
            { $group: { _id: "$lessonId", count: { $sum: 1 } } },
          ])
        : [],
      lessonIds.length
        ? Quiz.aggregate([
            { $match: { lessonId: { $in: lessonIds }, status: Status.ACTIVE } },
            { $group: { _id: "$lessonId", count: { $sum: 1 } } },
          ])
        : [],
      lessonIds.length
        ? LessonProgress.aggregate([
            { $match: { lessonId: { $in: lessonIds }, organizationId: orgOid } },
            {
              $group: {
                _id: "$lessonId",
                avgProgress: { $avg: "$progressPercent" },
              },
            },
          ])
        : [],
    ]);

    const fcMap = new Map(flashcardCounts.map((r) => [r._id.toString(), r.count as number]));
    const qMap = new Map(quizCounts.map((r) => [r._id.toString(), r.count as number]));
    const progMap = new Map(
      progressByLesson.map((r) => [r._id.toString(), Math.round(r.avgProgress ?? 0)])
    );

    const subjectMap = new Map(
      subjects.map((s) => [
        s._id.toString(),
        {
          subjectId: s._id.toString(),
          subjectName: s.name,
          lessons: [] as Array<{
            lessonId: string;
            title: string;
            generationStatus: string;
            quizCount: number;
            flashcardCount: number;
            avgProgress: number;
          }>,
        },
      ])
    );

    for (const lesson of lessons) {
      const sid = lesson.subjectId?.toString();
      if (!sid || !subjectMap.has(sid)) continue;
      const lid = lesson._id.toString();
      subjectMap.get(sid)!.lessons.push({
        lessonId: lid,
        title: lesson.title,
        generationStatus: lesson.generationStatus,
        quizCount: qMap.get(lid) ?? 0,
        flashcardCount: fcMap.get(lid) ?? 0,
        avgProgress: progMap.get(lid) ?? 0,
      });
    }

    const contentBySubject = [...subjectMap.values()].filter((s) => s.lessons.length > 0);

    const progressUserIds = [...new Set(recentProgress.map((p) => p.userId.toString()))];
    const progressLessonIds = [...new Set(recentProgress.map((p) => p.lessonId.toString()))];

    const [progressUsers, progressLessons] = await Promise.all([
      progressUserIds.length
        ? User.find({ _id: { $in: progressUserIds }, role: Role.STUDENT }).select(
            "firstName lastName"
          )
        : [],
      progressLessonIds.length
        ? Lesson.find({ _id: { $in: progressLessonIds } }).select("title")
        : [],
    ]);

    const userMap = new Map(progressUsers.map((u) => [u._id.toString(), u]));
    const lessonTitleMap = new Map(progressLessons.map((l) => [l._id.toString(), l.title]));

    const recentActivity = recentProgress
      .map((p) => {
        const student = userMap.get(p.userId.toString());
        if (!student) return null;
        return {
          studentId: p.userId.toString(),
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          lessonId: p.lessonId.toString(),
          lessonTitle: lessonTitleMap.get(p.lessonId.toString()) ?? "Lesson",
          progressPercent: p.progressPercent ?? 0,
          status: p.status,
          lastAccessedAt: p.lastAccessedAt,
        };
      })
      .filter(Boolean);

    const lowPerformers = atRiskProgress
      .map((p) => ({
        userId: p.userId,
        avg: Math.round(p.totalQuizScore / p.quizzesTaken),
        lessonsCompleted: p.lessonsCompleted ?? 0,
      }))
      .filter((p) => p.avg < 65)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);

    const atRiskUsers = lowPerformers.length
      ? await User.find({
          _id: { $in: lowPerformers.map((p) => p.userId) },
        }).select("firstName lastName")
      : [];

    const atRiskStudents = lowPerformers.map((lp) => {
      const u = atRiskUsers.find((x) => x._id.toString() === lp.userId.toString());
      if (!u) return null;
      return {
        studentId: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        averageQuizScore: lp.avg,
        lessonsCompleted: lp.lessonsCompleted,
      };
    }).filter(Boolean);

    const difficultLessonIds = difficultLessons.map((d) => d._id.toString());
    const difficultLessonDocs = difficultLessonIds.length
      ? await Lesson.find({ _id: { $in: difficultLessonIds } }).select("title")
      : [];
    const difficultTitleMap = new Map(
      difficultLessonDocs.map((l) => [l._id.toString(), l.title])
    );

    const focusLessons = difficultLessons.map((d) => ({
      lessonId: d._id.toString(),
      title: difficultTitleMap.get(d._id.toString()) ?? "Lesson",
      avgProgress: Math.round(d.avgProgress ?? 0),
      studentCount: d.studentCount ?? 0,
    }));

    return {
      contentBySubject,
      recentActivity,
      atRiskStudents,
      focusLessons,
    };
  }
}
