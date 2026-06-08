import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import ParentStudentLink from "../../../shared/models/parentStudentLink.model";
import { JwtPayload } from "../../../types/express.d";
import User from "../../auth/models/user.model";
import StudentProgress from "../../progress/models/studentProgress.model";
import QuizAttempt from "../../progress/models/quizAttempt.model";
import LessonProgress from "../../progress/models/lessonProgress.model";
import FlashcardReview from "../../progress/models/flashcardReview.model";
import { AnalyticsService } from "../../analytics/services/analytics.service";
import Subject from "../../academic/models/subject.model";
import CourseEnrollment from "../../academic/models/courseEnrollment.model";

export class ParentPortalService {
  static async getDashboard(user: JwtPayload, organizationId: string) {
    if (user.role !== Role.PARENT) {
      throw new AppError("Parent access required", 403);
    }
    await AccessControlService.assertOrgRead(user, organizationId);

    const links = await ParentStudentLink.find({
      parentId: user.sub,
      organizationId,
      status: Status.ACTIVE,
    });

    const students = await User.find({
      _id: { $in: links.map((l) => l.studentId) },
      status: Status.ACTIVE,
    }).select("firstName lastName email");

    let totalStudyTime = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const weakSubjects = new Set<string>();
    const strongSubjects = new Set<string>();

    for (const student of students) {
      const progress = await StudentProgress.findOne({
        userId: student._id,
        organizationId,
      });
      if (progress) {
        totalStudyTime += progress.totalStudyTimeMinutes;
        if (progress.quizzesTaken > 0) {
          totalScore += progress.totalQuizScore / progress.quizzesTaken;
          scoreCount += 1;
        }
        for (const topic of progress.weakTopics.slice(0, 2)) {
          weakSubjects.add(topic);
        }
      }

      const attempts = await QuizAttempt.find({
        userId: student._id,
        organizationId,
      })
        .sort({ completedAt: -1 })
        .limit(5);

      for (const a of attempts) {
        if (a.score >= 80) strongSubjects.add(a.lessonId.toString());
        else if (a.score < 60) weakSubjects.add(a.lessonId.toString());
      }
    }

    return {
      linkedStudents: students.map((s) => ({
        id: s._id.toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
      })),
      totalStudyTime,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      weakSubjects: [...weakSubjects].slice(0, 10),
      strongSubjects: [...strongSubjects].slice(0, 10),
    };
  }

  static async getStudentProgress(
    user: JwtPayload,
    organizationId: string,
    studentId: string
  ) {
    await AccessControlService.assertParentAccessToStudent(
      user.sub,
      studentId,
      organizationId
    );
    return AnalyticsService.studentDashboard(user, organizationId, studentId);
  }

  static async getStudentAnalytics(
    user: JwtPayload,
    organizationId: string,
    studentId: string
  ) {
    await AccessControlService.assertParentAccessToStudent(
      user.sub,
      studentId,
      organizationId
    );

    const [progress, retention, enrollments] = await Promise.all([
      StudentProgress.findOne({ userId: studentId, organizationId }),
      AnalyticsService.flashcardRetention(studentId, organizationId, user),
      CourseEnrollment.find({ studentId, organizationId, status: Status.ACTIVE }),
    ]);

    const subjects = await Subject.find({
      _id: { $in: enrollments.map((e) => e.subjectId) },
    }).select("name");

    return {
      progress,
      flashcardRetention: retention,
      enrolledSubjects: subjects.map((s) => ({
        id: s._id.toString(),
        name: s.name,
      })),
    };
  }

  static async getStudentActivity(
    user: JwtPayload,
    organizationId: string,
    studentId: string
  ) {
    await AccessControlService.assertParentAccessToStudent(
      user.sub,
      studentId,
      organizationId
    );

    const [lessons, quizzes, reviews] = await Promise.all([
      LessonProgress.find({ userId: studentId, organizationId })
        .sort({ lastAccessedAt: -1 })
        .limit(15),
      QuizAttempt.find({ userId: studentId, organizationId })
        .sort({ completedAt: -1 })
        .limit(15),
      FlashcardReview.find({ userId: studentId, organizationId })
        .sort({ reviewedAt: -1 })
        .limit(15),
    ]);

    return {
      lessonActivity: lessons,
      quizActivity: quizzes,
      flashcardActivity: reviews,
    };
  }
}
