import { Request, Response } from "express";
import { ApiResponse } from "../../../shared/utils/apiResponse";
import { ProgressService } from "../../progress/services/progress.service";
import { QuizService } from "../../quiz/services/quiz.service";
import { ChatService } from "../../chat/services/chat.service";
import { StudentPortalService } from "./studentPortal.service";
import { StudentSelfStudyService } from "./studentSelfStudy.service";
import { StudentLessonGroupService } from "./studentLessonGroup.service";
import { StudentNoteService } from "../../notes/services/studentNote.service";
import { MilestoneService } from "../../milestones/services/milestone.service";
import User from "../../auth/models/user.model";
import { StudentWorkspaceService } from "../../../shared/services/studentWorkspace.service";
import { resolveStudentOrganizationId } from "./studentOrganization.util";

export class StudentPortalController {
  static async dashboard(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getDashboard(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Student dashboard retrieved");
  }

  static async continueLearning(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.continueLearning(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Continue learning retrieved");
  }

  static async lessons(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.listLessons(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Lessons retrieved");
  }

  static async lessonDetail(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getLessonDetail(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Lesson detail retrieved");
  }

  static async completeLesson(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.completeLesson(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, data, "Lesson completed");
  }

  static async reviewFlashcards(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getReviewFlashcards(
      req.currentUser!,
      req.query.organizationId as string,
      Number(req.query.limit) || 20
    );
    return ApiResponse.success(res, data, "Due flashcards retrieved");
  }

  static async submitFlashcardReview(req: Request, res: Response): Promise<Response> {
    const data = await ProgressService.recordFlashcardReview(req.currentUser!, {
      flashcardId: req.params.id,
      result: req.body.result,
    });
    return ApiResponse.success(res, data, "Flashcard review recorded");
  }

  static async startQuiz(req: Request, res: Response): Promise<Response> {
    const quiz = await QuizService.getById(req.currentUser!, req.params.id, false);
    return ApiResponse.success(res, quiz, "Quiz started");
  }

  static async submitQuiz(req: Request, res: Response): Promise<Response> {
    const payload = {
      quizId: req.params.id,
      answers: req.body.answers,
      timeSpentSeconds: req.body.timeSpentSeconds,
    };
    if (req.body.practice === true) {
      const result = await ProgressService.gradeQuizPractice(
        req.currentUser!,
        payload
      );
      return ApiResponse.success(res, result, "Practice quiz graded");
    }
    const attempt = await ProgressService.submitQuizAttempt(
      req.currentUser!,
      payload
    );
    return ApiResponse.created(res, attempt, "Quiz submitted");
  }

  static async getQuizDraft(req: Request, res: Response): Promise<Response> {
    const draft = await ProgressService.getQuizDraft(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, draft, draft ? "Quiz draft retrieved" : "No draft");
  }

  static async saveQuizDraft(req: Request, res: Response): Promise<Response> {
    const draft = await ProgressService.saveQuizDraft(
      req.currentUser!,
      req.params.id,
      {
        answers: req.body.answers,
        currentStep: req.body.currentStep,
      }
    );
    return ApiResponse.success(res, draft, "Quiz progress saved");
  }

  static async chat(req: Request, res: Response): Promise<Response> {
    const message = await StudentPortalService.studentChat(
      req.currentUser!,
      req.body.organizationId,
      req.body.message,
      {
        sessionId: req.body.sessionId,
        lessonId: req.body.lessonId,
      }
    );
    return ApiResponse.success(res, message, "Chat response");
  }

  static async createPersonalLesson(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.createPersonalLesson(
      req.currentUser!,
      req.body.organizationId,
      {
        title: req.body.title,
        prompt: req.body.prompt,
        studentLevel: req.body.studentLevel,
        groupId: req.body.groupId,
      }
    );
    return ApiResponse.success(res, data, "Personal lesson created", 201);
  }

  static async uploadSelfStudyPdf(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return ApiResponse.error(res, "PDF file is required", 400);
    }
    const data = await StudentSelfStudyService.uploadPdf(
      req.currentUser!,
      req.body.organizationId,
      { title: req.body.title, description: req.body.description },
      req.file
    );
    return ApiResponse.created(res, data, "PDF uploaded — processing queued");
  }

  static async uploadSelfStudyText(req: Request, res: Response): Promise<Response> {
    const data = await StudentSelfStudyService.uploadText(
      req.currentUser!,
      req.body.organizationId,
      {
        title: req.body.title,
        content: req.body.content,
        description: req.body.description,
      }
    );
    return ApiResponse.created(res, data, "Text uploaded — processing queued");
  }

  static async uploadSelfStudyYoutube(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.uploadYoutube(
      req.currentUser!,
      req.body.organizationId,
      {
        title: req.body.title,
        youtubeUrl: req.body.youtubeUrl,
        description: req.body.description,
      }
    );
    return ApiResponse.created(
      res,
      data,
      "YouTube link added — processing queued"
    );
  }

  static async listSelfStudyMaterials(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.listMyMaterials(
      req.currentUser!,
      req.query.organizationId as string,
      {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        processingStatus: req.query.processingStatus as string | undefined,
      }
    );
    return ApiResponse.success(res, data, "Materials retrieved");
  }

  static async deleteSelfStudyMaterial(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.deleteSelfStudyMaterial(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, data.message ?? "Material deleted");
  }

  static async addMaterialsToPersonalLesson(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.addMaterialsToPersonalLesson(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id,
      {
        materialIds: req.body.materialIds,
        reprocess: req.body.reprocess,
      }
    );
    return ApiResponse.success(
      res,
      data,
      data.message ?? "Materials added to lesson"
    );
  }

  static async createPersonalLessonFromMaterials(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.createPersonalLessonFromMaterials(
      req.currentUser!,
      req.body.organizationId,
      {
        title: req.body.title,
        materialIds: req.body.materialIds,
        studentLevel: req.body.studentLevel,
        groupId: req.body.groupId,
      }
    );
    return ApiResponse.success(
      res,
      data,
      "Lesson generation queued from materials",
      201
    );
  }

  static async listPersonalLessons(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.listPersonalLessons(
      req.currentUser!,
      req.query.organizationId as string,
      {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        generationStatus: req.query.generationStatus as string | undefined,
        groupId: req.query.groupId as string | undefined,
      }
    );
    return ApiResponse.success(res, data, "Personal lessons retrieved");
  }

  static async selfStudyStatus(req: Request, res: Response): Promise<Response> {
    const data = await StudentSelfStudyService.getGenerationStatus(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, "Generation status retrieved");
  }

  static async regeneratePersonalLesson(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.regeneratePersonalLesson(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id,
      { prompt: req.body.prompt, studentLevel: req.body.studentLevel }
    );
    return ApiResponse.success(res, data, data.message ?? "Lesson reprocessing started");
  }

  static async deletePersonalLesson(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.deletePersonalLesson(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id
    );
    return ApiResponse.success(res, data, data.message);
  }

  static async generateFlashcards(
    req: Request,
    res: Response
  ): Promise<Response> {
    const data = await StudentSelfStudyService.generateFlashcards(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id,
      {
        count: req.body.count,
        difficulty: req.body.difficulty,
        title: req.body.title,
      }
    );
    return ApiResponse.success(res, data, "Flashcard generation queued");
  }

  static async generateQuiz(req: Request, res: Response): Promise<Response> {
    const data = await StudentSelfStudyService.generateQuiz(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id,
      {
        count: req.body.count,
        difficulty: req.body.difficulty,
        title: req.body.title,
      }
    );
    return ApiResponse.success(res, data, "Quiz generation queued");
  }

  static async listNotes(req: Request, res: Response): Promise<Response> {
    const data = await StudentNoteService.list(
      req.currentUser!,
      req.query.organizationId as string,
      {
        lessonId: req.query.lessonId as string | undefined,
        quizId: req.query.quizId as string | undefined,
        flashcardId: req.query.flashcardId as string | undefined,
        scope: req.query.scope as "all" | "general" | "lesson" | undefined,
      }
    );
    return ApiResponse.success(res, data, "Notes retrieved");
  }

  static async saveNote(req: Request, res: Response): Promise<Response> {
    const data = await StudentNoteService.upsert(
      req.currentUser!,
      req.body.organizationId,
      {
        id: req.body.id,
        lessonId: req.body.lessonId,
        quizId: req.body.quizId,
        flashcardId: req.body.flashcardId,
        title: req.body.title,
        content: req.body.content,
      }
    );
    return ApiResponse.success(res, data, "Note saved");
  }

  static async deleteNote(req: Request, res: Response): Promise<Response> {
    await StudentNoteService.delete(req.currentUser!, req.params.id);
    return ApiResponse.success(res, null, "Note deleted");
  }

  static async milestones(req: Request, res: Response): Promise<Response> {
    const data = await MilestoneService.listForUser(
      req.currentUser!.sub,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Milestones retrieved");
  }

  static async chatHistory(req: Request, res: Response): Promise<Response> {
    const lessonId = req.query.lessonId as string | undefined;
    const sessions = await ChatService.listLessonSessions(
      req.currentUser!,
      req.query.organizationId as string,
      lessonId
    );
    return ApiResponse.success(res, sessions, "Chat sessions retrieved");
  }

  static async chatSession(req: Request, res: Response): Promise<Response> {
    const session = await ChatService.getSession(
      req.currentUser!,
      req.params.id
    );
    return ApiResponse.success(res, session, "Chat session retrieved");
  }

  static async renameChatSession(req: Request, res: Response): Promise<Response> {
    const session = await ChatService.renameSession(
      req.currentUser!,
      req.params.id,
      req.body.title
    );
    return ApiResponse.success(res, session, "Chat session renamed");
  }

  static async deleteChatSession(req: Request, res: Response): Promise<Response> {
    await ChatService.deleteSession(req.currentUser!, req.params.id);
    return ApiResponse.success(res, null, "Chat session deleted");
  }

  static async recommendations(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getRecommendations(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Recommendations retrieved");
  }

  static async learningPath(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getLearningPath(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Learning path retrieved");
  }

  static async revisionPlan(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getRevisionPlan(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Revision plan retrieved");
  }

  static async history(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getHistory(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Study history retrieved");
  }

  static async achievements(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getAchievements(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Achievements retrieved");
  }

  static async provisionWorkspace(req: Request, res: Response): Promise<Response> {
    const user = await User.findById(req.currentUser!.sub);
    if (!user) {
      return ApiResponse.error(res, "User not found", 404);
    }
    if (user.organizationId) {
      return ApiResponse.success(
        res,
        { organizationId: user.organizationId.toString() },
        "Workspace already linked"
      );
    }
    const org = await StudentWorkspaceService.provisionPersonalWorkspace(user);
    return ApiResponse.success(
      res,
      { organizationId: org._id.toString() },
      "Personal workspace created"
    );
  }

  static async subscription(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getSubscription(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Subscription retrieved");
  }

  static async studyQueue(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getStudyQueue(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Study queue retrieved");
  }

  static async practice(req: Request, res: Response): Promise<Response> {
    const data = await StudentPortalService.getPractice(
      req.currentUser!,
      req.query.organizationId as string
    );
    return ApiResponse.success(res, data, "Practice items retrieved");
  }

  static async leaderboard(req: Request, res: Response): Promise<Response> {
    const scope =
      req.query.scope === "global" ? "global" : "organization";
    const data = await StudentPortalService.getLeaderboard(
      req.currentUser!,
      req.query.organizationId as string,
      scope
    );
    return ApiResponse.success(res, data, "Leaderboard retrieved");
  }

  static async listLessonGroups(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.list(
      req.currentUser!,
      organizationId
    );
    return ApiResponse.success(res, { ...data, organizationId }, "Lesson groups retrieved");
  }

  static async createLessonGroup(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.create(
      req.currentUser!,
      organizationId,
      { title: req.body.title, description: req.body.description }
    );
    return ApiResponse.success(
      res,
      { ...data, organizationId },
      "Lesson group created",
      201
    );
  }

  static async updateLessonGroup(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.update(
      req.currentUser!,
      organizationId,
      req.params.id,
      {
        title: req.body.title,
        description: req.body.description,
        order: req.body.order,
      }
    );
    return ApiResponse.success(res, data, "Lesson group updated");
  }

  static async deleteLessonGroup(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.delete(
      req.currentUser!,
      organizationId,
      req.params.id
    );
    return ApiResponse.success(res, data, data.message);
  }

  static async listGroupLessons(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.listGroupLessons(
      req.currentUser!,
      organizationId,
      req.params.id
    );
    return ApiResponse.success(res, data, "Group lessons retrieved");
  }

  static async assignLessonGroup(req: Request, res: Response): Promise<Response> {
    const organizationId = await resolveStudentOrganizationId(req);
    const data = await StudentLessonGroupService.assignLesson(
      req.currentUser!,
      organizationId,
      req.params.id,
      { groupId: req.body.groupId, groupOrder: req.body.groupOrder }
    );
    return ApiResponse.success(res, data, data.message);
  }

  static async createNextLesson(req: Request, res: Response): Promise<Response> {
    const data = await StudentSelfStudyService.createNextLessonFromSuggestion(
      req.currentUser!,
      req.query.organizationId as string,
      req.params.id,
      { prompt: req.body.prompt, studentLevel: req.body.studentLevel }
    );
    return ApiResponse.success(res, data, "Next lesson created", 201);
  }
}
