import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Difficulty } from "../../../shared/enums/difficulty.enum";
import { QuizQuestionType } from "../../../shared/enums/quizQuestionType.enum";
import { IQuiz } from "../models/quiz.model";
import { IQuizQuestion } from "../models/quizQuestion.model";

export interface QuizResponse {
  id: string;
  organizationId: string;
  lessonId: string;
  title: string;
  questionCount: number;
  generationStatus: ProcessingStatus;
  errorMessage?: string;
  jobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestionResponse {
  id: string;
  quizId: string;
  lessonId: string;
  type: QuizQuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: Difficulty;
  order: number;
}

export interface QuizWithQuestionsResponse extends QuizResponse {
  questions: QuizQuestionResponse[];
}

export function toQuizResponse(quiz: IQuiz): QuizResponse {
  return {
    id: quiz._id.toString(),
    organizationId: quiz.organizationId.toString(),
    lessonId: quiz.lessonId.toString(),
    title: quiz.title,
    questionCount: quiz.questionCount,
    generationStatus: quiz.generationStatus,
    errorMessage: quiz.errorMessage,
    jobId: quiz.jobId,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

export function toQuizQuestionResponse(
  question: IQuizQuestion,
  includeAnswer = true
): QuizQuestionResponse {
  return {
    id: question._id.toString(),
    quizId: question.quizId.toString(),
    lessonId: question.lessonId.toString(),
    type: question.type,
    question: question.question,
    options: question.options,
    correctAnswer: includeAnswer ? question.correctAnswer : "",
    explanation: includeAnswer ? question.explanation : "",
    difficulty: question.difficulty,
    order: question.order,
  };
}
