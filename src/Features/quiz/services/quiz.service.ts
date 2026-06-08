import { Role } from "../../../shared/enums/roles.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { JwtPayload } from "../../../types/express.d";
import Lesson from "../../lesson/models/lesson.model";
import {
  QuizQuestionResponse,
  QuizResponse,
  QuizWithQuestionsResponse,
  toQuizQuestionResponse,
  toQuizResponse,
} from "../dto/quiz.dto";
import Quiz from "../models/quiz.model";
import QuizQuestion from "../models/quizQuestion.model";

export class QuizService {
  static async getByLesson(
    user: JwtPayload,
    lessonId: string
  ): Promise<QuizResponse> {
    const lesson = await this.getLessonOrFail(lessonId);
    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const quiz = await Quiz.findOne({
      lessonId,
      status: Status.ACTIVE,
    });

    if (!quiz) {
      throw new AppError("Quiz not found for this lesson", 404);
    }

    return toQuizResponse(quiz);
  }

  static async getById(
    user: JwtPayload,
    quizId: string,
    includeAnswers = false
  ): Promise<QuizWithQuestionsResponse> {
    const quiz = await Quiz.findOne({
      _id: quizId,
      status: Status.ACTIVE,
    });

    if (!quiz) {
      throw new AppError("Quiz not found", 404);
    }

    await OrganizationAccessService.assertReadAccess(
      user,
      quiz.organizationId.toString()
    );

    const canSeeAnswers =
      includeAnswers ||
      [Role.TEACHER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.PARENT].includes(
        user.role
      );

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
      status: Status.ACTIVE,
    }).sort({ order: 1 });

    return {
      ...toQuizResponse(quiz),
      questions: questions.map((q) =>
        toQuizQuestionResponse(q, canSeeAnswers)
      ),
    };
  }

  static async getQuestionsByLesson(
    user: JwtPayload,
    lessonId: string
  ): Promise<QuizQuestionResponse[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const quiz = await Quiz.findOne({ lessonId, status: Status.ACTIVE });
    if (!quiz) {
      throw new AppError("Quiz not found for this lesson", 404);
    }

    const canSeeAnswers = [
      Role.TEACHER,
      Role.SCHOOL_ADMIN,
      Role.SUPER_ADMIN,
      Role.PARENT,
    ].includes(user.role);

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
      status: Status.ACTIVE,
    }).sort({ order: 1 });

    return questions.map((q) => toQuizQuestionResponse(q, canSeeAnswers));
  }

  private static async getLessonOrFail(lessonId: string) {
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
