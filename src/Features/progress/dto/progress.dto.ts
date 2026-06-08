import { FlashcardReviewResult, LessonProgressStatus } from "../../../shared/enums/progress.enum";
import { ILessonProgress } from "../models/lessonProgress.model";
import { IQuizAttempt } from "../models/quizAttempt.model";

export interface UpdateLessonProgressInput {
  progressPercent?: number;
  timeSpentMinutes?: number;
  markComplete?: boolean;
}

export interface QuizAttemptInput {
  quizId: string;
  answers: { questionId: string; answer: string }[];
  timeSpentSeconds?: number;
}

export interface FlashcardReviewInput {
  flashcardId: string;
  result: FlashcardReviewResult;
}

export interface LessonProgressResponse {
  id: string;
  lessonId: string;
  organizationId: string;
  status: LessonProgressStatus;
  progressPercent: number;
  timeSpentMinutes: number;
  completedAt?: Date;
  lastAccessedAt: Date;
}

export interface QuizAttemptResponse {
  id: string;
  quizId: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpentSeconds: number;
  completedAt: Date;
}

export interface DashboardResponse {
  userId: string;
  organizationId: string;
  lessonsCompleted: number;
  totalLessons: number;
  lessonCompletionRate: number;
  quizzesTaken: number;
  averageQuizScore: number;
  flashcardsReviewed: number;
  flashcardAccuracy: number;
  totalStudyTimeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  weakTopics: string[];
  lessonProgress: LessonProgressResponse[];
  recentQuizAttempts: QuizAttemptResponse[];
  recentFlashcardReviews: {
    flashcardId: string;
    lessonId: string;
    result: FlashcardReviewResult;
    reviewedAt: Date;
  }[];
}

export function toLessonProgressResponse(
  record: ILessonProgress
): LessonProgressResponse {
  return {
    id: record._id.toString(),
    lessonId: record.lessonId.toString(),
    organizationId: record.organizationId.toString(),
    status: record.status,
    progressPercent: record.progressPercent,
    timeSpentMinutes: record.timeSpentMinutes,
    completedAt: record.completedAt,
    lastAccessedAt: record.lastAccessedAt,
  };
}

export function toQuizAttemptResponse(
  attempt: IQuizAttempt
): QuizAttemptResponse {
  return {
    id: attempt._id.toString(),
    quizId: attempt.quizId.toString(),
    lessonId: attempt.lessonId.toString(),
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    timeSpentSeconds: attempt.timeSpentSeconds,
    completedAt: attempt.completedAt,
  };
}
