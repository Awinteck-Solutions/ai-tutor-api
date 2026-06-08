import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";
import {
  FlashcardReviewResult,
  LessonProgressStatus,
} from "../../../shared/enums/progress.enum";
import { AppError } from "../../../shared/errors/AppError";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { JwtPayload } from "../../../types/express.d";
import Lesson from "../../lesson/models/lesson.model";
import Quiz from "../../quiz/models/quiz.model";
import QuizQuestion from "../../quiz/models/quizQuestion.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import LessonProgress from "../models/lessonProgress.model";
import QuizAttempt from "../models/quizAttempt.model";
import QuizDraft from "../models/quizDraft.model";
import FlashcardReview from "../models/flashcardReview.model";
import { SpacedRepetitionService } from "./spacedRepetition.service";
import { ProgressTrackingService } from "./progressTracking.service";
import { XpService } from "../../xp/services/xp.service";
import { XpSourceType } from "../../../shared/enums/xpSourceType.enum";
import {
  DashboardResponse,
  LessonProgressResponse,
  QuizAttemptInput,
  QuizAttemptResponse,
  FlashcardReviewInput,
  UpdateLessonProgressInput,
  toLessonProgressResponse,
  toQuizAttemptResponse,
} from "../dto/progress.dto";

export class ProgressService {
  static async getDashboard(
    user: JwtPayload,
    organizationId: string,
    targetUserId?: string
  ): Promise<DashboardResponse> {
    const userId = targetUserId ?? user.sub;

    if (userId !== user.sub) {
      await OrganizationAccessService.assertManageAccess(user, organizationId);
    } else {
      await OrganizationAccessService.assertReadAccess(user, organizationId);
    }

    const progress = await ProgressTrackingService.getOrCreate(
      userId,
      organizationId
    );

    const [totalLessons, lessonProgressList, recentAttempts, recentReviews] =
      await Promise.all([
        Lesson.countDocuments({
          organizationId,
          status: Status.ACTIVE,
          generationStatus: ProcessingStatus.COMPLETED,
        }),
        LessonProgress.find({ userId, organizationId }),
        QuizAttempt.find({ userId, organizationId })
          .sort({ completedAt: -1 })
          .limit(5),
        FlashcardReview.find({ userId, organizationId })
          .sort({ reviewedAt: -1 })
          .limit(5),
      ]);

    const averageQuizScore =
      progress.quizzesTaken > 0
        ? Math.round(progress.totalQuizScore / progress.quizzesTaken)
        : 0;

    const flashcardAccuracy =
      progress.flashcardsReviewed > 0
        ? Math.round(
            (progress.flashcardsCorrect / progress.flashcardsReviewed) * 100
          )
        : 0;

    return {
      userId,
      organizationId,
      lessonsCompleted: progress.lessonsCompleted,
      totalLessons,
      lessonCompletionRate:
        totalLessons > 0
          ? Math.round((progress.lessonsCompleted / totalLessons) * 100)
          : 0,
      quizzesTaken: progress.quizzesTaken,
      averageQuizScore,
      flashcardsReviewed: progress.flashcardsReviewed,
      flashcardAccuracy,
      totalStudyTimeMinutes: progress.totalStudyTimeMinutes,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      weakTopics: progress.weakTopics,
      lessonProgress: lessonProgressList.map(toLessonProgressResponse),
      recentQuizAttempts: recentAttempts.map(toQuizAttemptResponse),
      recentFlashcardReviews: recentReviews.map((r) => ({
        flashcardId: r.flashcardId.toString(),
        lessonId: r.lessonId.toString(),
        result: r.result,
        reviewedAt: r.reviewedAt,
      })),
    };
  }

  static async listLessonProgress(
    user: JwtPayload,
    organizationId: string
  ): Promise<LessonProgressResponse[]> {
    await OrganizationAccessService.assertReadAccess(user, organizationId);

    const items = await LessonProgress.find({
      userId: user.sub,
      organizationId,
    }).sort({ lastAccessedAt: -1 });

    return items.map(toLessonProgressResponse);
  }

  static async updateLessonProgress(
    user: JwtPayload,
    lessonId: string,
    input: UpdateLessonProgressInput
  ): Promise<LessonProgressResponse & { xp?: unknown }> {
    const lesson = await Lesson.findOne({
      _id: lessonId,
      status: Status.ACTIVE,
    });
    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    let record = await LessonProgress.findOne({
      userId: user.sub,
      lessonId,
    });

    const wasCompleted =
      record?.status === LessonProgressStatus.COMPLETED;

    if (!record) {
      record = await LessonProgress.create({
        userId: user.sub,
        organizationId: lesson.organizationId,
        lessonId,
        status: LessonProgressStatus.IN_PROGRESS,
        lastAccessedAt: new Date(),
      });
    }

    if (input.timeSpentMinutes && input.timeSpentMinutes > 0) {
      record.timeSpentMinutes += input.timeSpentMinutes;
    }

    if (input.progressPercent !== undefined) {
      record.progressPercent = Math.min(100, Math.max(0, input.progressPercent));
    }

    if (input.markComplete || record.progressPercent >= 100) {
      record.status = LessonProgressStatus.COMPLETED;
      record.progressPercent = 100;
      record.completedAt = record.completedAt ?? new Date();
    } else if (record.status === LessonProgressStatus.NOT_STARTED) {
      record.status = LessonProgressStatus.IN_PROGRESS;
    }

    record.lastAccessedAt = new Date();
    await record.save();

    let xpAward = null;
    if (record.status === LessonProgressStatus.COMPLETED && !wasCompleted) {
      const aggregate = await ProgressTrackingService.getOrCreate(
        user.sub,
        lesson.organizationId.toString()
      );
      aggregate.lessonsCompleted += 1;
      await aggregate.save();

      xpAward = await XpService.tryAward(
        user.sub,
        lesson.organizationId.toString(),
        XpSourceType.LESSON,
        lessonId
      );
    }

    await ProgressTrackingService.recordStudyActivity(
      user.sub,
      lesson.organizationId.toString(),
      input.timeSpentMinutes ?? 0
    );

    const response = toLessonProgressResponse(record);
    return { ...response, xp: xpAward };
  }

  /** Grade answers only — no attempt saved, no XP, no aggregate updates (retake / practice). */
  static async gradeQuizPractice(
    user: JwtPayload,
    input: QuizAttemptInput
  ) {
    const quiz = await Quiz.findOne({
      _id: input.quizId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    });
    if (!quiz) throw new AppError("Quiz not found or not ready", 404);

    const lesson = await Lesson.findById(quiz.lessonId);
    if (!lesson) throw new AppError("Lesson not found", 404);

    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
      status: Status.ACTIVE,
    });
    if (questions.length === 0) {
      throw new AppError("Quiz has no questions", 422);
    }

    const questionMap = new Map(
      questions.map((q) => [q._id.toString(), q])
    );

    let correct = 0;
    const gradedAnswers = input.answers.map((a) => {
      const question = questionMap.get(a.questionId);
      if (!question) {
        throw new AppError(`Invalid question ID: ${a.questionId}`, 400);
      }
      const isCorrect =
        a.answer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase();
      if (isCorrect) correct++;
      return {
        questionId: question._id.toString(),
        question: question.question,
        userAnswer: a.answer,
        isCorrect,
        correctAnswer: question.correctAnswer,
      };
    });

    const score = Math.round((correct / questions.length) * 100);

    return {
      practice: true,
      score,
      totalQuestions: questions.length,
      correctAnswers: correct,
      answers: gradedAnswers,
      xp: null,
    };
  }

  static async submitQuizAttempt(
    user: JwtPayload,
    input: QuizAttemptInput
  ): Promise<QuizAttemptResponse & { xp?: unknown }> {
    const quiz = await Quiz.findOne({
      _id: input.quizId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    });
    if (!quiz) {
      throw new AppError("Quiz not found or not ready", 404);
    }

    const lesson = await Lesson.findById(quiz.lessonId);
    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
      status: Status.ACTIVE,
    });

    if (questions.length === 0) {
      throw new AppError("Quiz has no questions", 422);
    }

    const questionMap = new Map(
      questions.map((q) => [q._id.toString(), q])
    );

    let correct = 0;
    const gradedAnswers = input.answers.map((a) => {
      const question = questionMap.get(a.questionId);
      if (!question) {
        throw new AppError(`Invalid question ID: ${a.questionId}`, 400);
      }
      const isCorrect =
        a.answer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase();
      if (isCorrect) correct++;
      return {
        questionId: question._id,
        answer: a.answer,
        isCorrect,
      };
    });

    const score = Math.round((correct / questions.length) * 100);

    const priorAttempt = await QuizAttempt.findOne({
      userId: user.sub,
      quizId: quiz._id,
    });
    if (priorAttempt) {
      throw new AppError("Quiz already completed. Use practice retake instead.", 400);
    }

    const attempt = await QuizAttempt.create({
      userId: user.sub,
      organizationId: lesson.organizationId,
      quizId: quiz._id,
      lessonId: lesson._id,
      score,
      totalQuestions: questions.length,
      correctAnswers: correct,
      answers: gradedAnswers,
      timeSpentSeconds: input.timeSpentSeconds ?? 0,
    });

    await QuizDraft.deleteOne({ userId: user.sub, quizId: quiz._id });

    const aggregate = await ProgressTrackingService.getOrCreate(
      user.sub,
      lesson.organizationId.toString()
    );
    aggregate.quizzesTaken += 1;
    aggregate.totalQuizScore += score;
    await aggregate.save();

    if (score < 70) {
      await ProgressTrackingService.addWeakTopics(
        user.sub,
        lesson.organizationId.toString(),
        lesson.concepts.slice(0, 3)
      );
    }

    const studyMinutes = Math.ceil((input.timeSpentSeconds ?? 0) / 60);
    await ProgressTrackingService.recordStudyActivity(
      user.sub,
      lesson.organizationId.toString(),
      studyMinutes
    );

    let xpAward = null;
    if (!priorAttempt) {
      xpAward = await XpService.tryAward(
        user.sub,
        lesson.organizationId.toString(),
        XpSourceType.QUIZ,
        quiz._id.toString()
      );
    }

    return {
      ...toQuizAttemptResponse(attempt),
      xp: xpAward,
    } as QuizAttemptResponse & { xp?: unknown };
  }

  static async recordFlashcardReview(
    user: JwtPayload,
    input: FlashcardReviewInput
  ): Promise<{ recorded: boolean; xp?: unknown }> {
    const flashcard = await Flashcard.findOne({
      _id: input.flashcardId,
      status: Status.ACTIVE,
    });
    if (!flashcard) {
      throw new AppError("Flashcard not found", 404);
    }

    await OrganizationAccessService.assertReadAccess(
      user,
      flashcard.organizationId.toString()
    );

    await FlashcardReview.create({
      userId: user.sub,
      organizationId: flashcard.organizationId,
      flashcardId: flashcard._id,
      lessonId: flashcard.lessonId,
      result: input.result,
      difficulty: flashcard.difficulty,
    });

    await SpacedRepetitionService.review(
      user.sub,
      flashcard.organizationId.toString(),
      flashcard._id.toString(),
      input.result
    );

    const aggregate = await ProgressTrackingService.getOrCreate(
      user.sub,
      flashcard.organizationId.toString()
    );
    aggregate.flashcardsReviewed += 1;
    if (input.result === FlashcardReviewResult.CORRECT) {
      aggregate.flashcardsCorrect += 1;
    } else {
      const lesson = await Lesson.findById(flashcard.lessonId);
      if (lesson?.concepts.length) {
        await ProgressTrackingService.addWeakTopics(
          user.sub,
          flashcard.organizationId.toString(),
          [lesson.concepts[0]]
        );
      }
    }
    await aggregate.save();

    await ProgressTrackingService.recordStudyActivity(
      user.sub,
      flashcard.organizationId.toString(),
      1
    );

    const xpAward = await ProgressService.tryAwardFlashcardLessonSet(
      user.sub,
      flashcard.organizationId.toString(),
      flashcard.lessonId.toString()
    );

    return { recorded: true, xp: xpAward } as { recorded: boolean; xp?: unknown };
  }

  /** Award XP once when every flashcard in a lesson has been reviewed at least once. */
  static async tryAwardFlashcardLessonSet(
    userId: string,
    organizationId: string,
    lessonId: string
  ) {
    const total = await Flashcard.countDocuments({
      lessonId,
      status: Status.ACTIVE,
    });
    if (total === 0) return null;

    const reviewedIds = await FlashcardReview.distinct("flashcardId", {
      userId,
      lessonId,
    });
    if (reviewedIds.length < total) return null;

    return XpService.tryAward(
      userId,
      organizationId,
      XpSourceType.FLASHCARD_LESSON,
      lessonId
    );
  }

  static async getQuizDraft(user: JwtPayload, quizId: string) {
    const draft = await QuizDraft.findOne({ userId: user.sub, quizId });
    if (!draft) return null;

    return {
      quizId: draft.quizId.toString(),
      lessonId: draft.lessonId.toString(),
      answers: draft.answers.map((a) => ({
        questionId: a.questionId.toString(),
        answer: a.answer,
      })),
      currentStep: draft.currentStep,
      updatedAt: draft.updatedAt,
    };
  }

  static async saveQuizDraft(
    user: JwtPayload,
    quizId: string,
    input: {
      answers: { questionId: string; answer: string }[];
      currentStep?: number;
    }
  ) {
    const quiz = await Quiz.findOne({
      _id: quizId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    });
    if (!quiz) throw new AppError("Quiz not found or not ready", 404);

    const lesson = await Lesson.findById(quiz.lessonId);
    if (!lesson) throw new AppError("Lesson not found", 404);

    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const completed = await QuizAttempt.findOne({
      userId: user.sub,
      quizId: quiz._id,
    });
    if (completed) {
      throw new AppError("Quiz already completed", 400);
    }

    const draft = await QuizDraft.findOneAndUpdate(
      { userId: user.sub, quizId: quiz._id },
      {
        userId: user.sub,
        organizationId: lesson.organizationId,
        quizId: quiz._id,
        lessonId: lesson._id,
        answers: input.answers.map((a) => ({
          questionId: a.questionId,
          answer: a.answer ?? "",
        })),
        currentStep: input.currentStep ?? 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      quizId: draft.quizId.toString(),
      lessonId: draft.lessonId.toString(),
      answers: draft.answers.map((a) => ({
        questionId: a.questionId.toString(),
        answer: a.answer,
      })),
      currentStep: draft.currentStep,
      updatedAt: draft.updatedAt,
    };
  }
}
