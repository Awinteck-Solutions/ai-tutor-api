import { ChatMessageRole } from "../../../shared/enums/chat.enum";
import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { AISafetyService } from "../../../shared/services/aiSafety.service";
import { AcademicHierarchyService } from "../../../shared/services/academicHierarchy.service";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { JwtPayload } from "../../../types/express.d";
import { AIService, ChatMessage as AIChatMessage } from "../../../services/ai/ai.service";
import { RAGService } from "../../../services/rag/rag.service";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import Quiz from "../../quiz/models/quiz.model";
import QuizQuestion from "../../quiz/models/quizQuestion.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import { buildLessonContext } from "../../../shared/services/content.service";
import Topic from "../../academic/models/topic.model";
import Subject from "../../academic/models/subject.model";
import AcademicYear from "../../academic/models/academicYear.model";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import ChatSession from "../models/chatSession.model";
import ChatMessageModel from "../models/chatMessage.model";
import {
  ChatMessageResponse,
  ChatSessionResponse,
  CreateSessionInput,
  NormalizedCreateSessionInput,
  SendMessageInput,
  normalizeCreateSessionInput,
  toChatMessageResponse,
  toChatSessionResponse,
} from "../dto/chat.dto";
import { ProgressTrackingService } from "../../progress/services/progressTracking.service";

const MAX_HISTORY = 10;

export class ChatService {
  static async createSession(
    user: JwtPayload,
    input: CreateSessionInput
  ): Promise<ChatSessionResponse> {
    const normalized = normalizeCreateSessionInput(input);

    await OrganizationAccessService.assertReadAccess(
      user,
      normalized.organizationId
    );

    await this.validateContext(normalized);

    const title = normalized.title ?? (await this.defaultTitle(normalized));

    const session = await ChatSession.create({
      userId: user.sub,
      organizationId: normalized.organizationId,
      title,
      contextType: normalized.contextType,
      ...(normalized.academicYearId && {
        academicYearId: normalized.academicYearId,
      }),
      ...(normalized.subjectId && { subjectId: normalized.subjectId }),
      ...(normalized.topicId && { topicId: normalized.topicId }),
      ...(normalized.materialId && { materialId: normalized.materialId }),
      ...(normalized.lessonId && { lessonId: normalized.lessonId }),
      ...(normalized.quizId && { quizId: normalized.quizId }),
      ...(normalized.flashcardId && { flashcardId: normalized.flashcardId }),
    });

    return toChatSessionResponse(session);
  }

  static async listSessions(
    user: JwtPayload,
    organizationId: string
  ): Promise<ChatSessionResponse[]> {
    await OrganizationAccessService.assertReadAccess(user, organizationId);

    const sessions = await ChatSession.find({
      userId: user.sub,
      organizationId,
      status: Status.ACTIVE,
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return this.enrichSessions(sessions);
  }

  static async listLessonSessions(
    user: JwtPayload,
    organizationId: string,
    lessonId?: string
  ): Promise<ChatSessionResponse[]> {
    await OrganizationAccessService.assertReadAccess(user, organizationId);

    const filter: Record<string, unknown> = {
      userId: user.sub,
      organizationId,
      status: Status.ACTIVE,
      lessonId: { $exists: true, $ne: null },
    };
    if (lessonId) {
      filter.lessonId = lessonId;
    }

    const sessions = await ChatSession.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100);

    const enriched = await this.enrichSessions(sessions);
    const lessonIds = [
      ...new Set(
        sessions
          .map((s) => s.lessonId?.toString())
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const lessons = lessonIds.length
      ? await Lesson.find({ _id: { $in: lessonIds } }).select("title")
      : [];
    const titleMap = new Map(
      lessons.map((l) => [l._id.toString(), l.title])
    );

    return enriched.map((session) => ({
      ...session,
      lessonTitle: session.lessonId
        ? titleMap.get(session.lessonId) ?? "Lesson"
        : undefined,
    }));
  }

  static async renameSession(
    user: JwtPayload,
    sessionId: string,
    title: string
  ): Promise<ChatSessionResponse> {
    const session = await this.findSessionOrFail(sessionId, user.sub);
    const trimmed = title.trim();
    if (!trimmed) {
      throw new AppError("Title cannot be empty", 400);
    }
    session.title = trimmed.slice(0, 120);
    await session.save();
    return toChatSessionResponse(session);
  }

  static async getSession(
    user: JwtPayload,
    sessionId: string
  ): Promise<ChatSessionResponse & { messages: ChatMessageResponse[] }> {
    const session = await this.findSessionOrFail(sessionId, user.sub);

    const messages = await ChatMessageModel.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(100);

    return {
      ...toChatSessionResponse(session),
      messages: messages.map(toChatMessageResponse),
    };
  }

  static async sendMessage(
    user: JwtPayload,
    sessionId: string,
    input: SendMessageInput
  ): Promise<ChatMessageResponse> {
    const session = await this.findSessionOrFail(sessionId, user.sub);

    AISafetyService.validateUserPrompt(input.message);
    if (AISafetyService.shouldRefuseOffTopic(input.message)) {
      throw new AppError(
        "Please ask questions related to your study materials and lessons.",
        400
      );
    }

    await ChatMessageModel.create({
      sessionId: session._id,
      role: ChatMessageRole.USER,
      content: input.message,
      sources: [],
    });

    const inlineContext = await this.buildInlineContext(session);
    const rag = await RAGService.retrieve({
      query: input.message,
      organizationId: session.organizationId.toString(),
      academicYearId: session.academicYearId?.toString(),
      subjectId: session.subjectId?.toString(),
      topicId: session.topicId?.toString(),
      materialId: session.materialId?.toString(),
      lessonId: session.lessonId?.toString(),
    });

    const combinedContext = [inlineContext, rag.combinedText]
      .filter(Boolean)
      .join("\n\n");

    const history = await ChatMessageModel.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY);

    const chatHistory: AIChatMessage[] = history
      .reverse()
      .slice(0, -1)
      .map((m) => ({
        role: m.role === ChatMessageRole.USER ? "user" : "assistant",
        content: m.content,
      }));

    const messages: AIChatMessage[] = [
      {
        role: "system",
        content: AISafetyService.buildEducationalSystemPrompt(combinedContext),
      },
      ...chatHistory,
      { role: "user", content: input.message },
    ];

    const answer = await AIService.chat(messages, {
      organizationId: session.organizationId.toString(),
      userId: user.sub,
      operation: "chat",
    });

    const sources = rag.chunks.map((c) => ({
      materialId: c.materialId,
      materialName: c.title ?? "Study material",
      chunkIndex: c.chunkIndex,
      page: c.page ?? Math.floor(c.chunkIndex / 3) + 1,
      score: c.score,
      preview: c.content.slice(0, 200),
    }));

    const assistantMessage = await ChatMessageModel.create({
      sessionId: session._id,
      role: ChatMessageRole.ASSISTANT,
      content: answer,
      sources,
    });

    session.lastMessageAt = new Date();
    const autoTitles = ["New Chat", "Student Tutor", "Organization Chat"];
    if (
      autoTitles.includes(session.title) ||
      session.title.startsWith("Chat:")
    ) {
      session.title = input.message.slice(0, 60);
    }
    await session.save();

    await ProgressTrackingService.recordStudyActivity(
      user.sub,
      session.organizationId.toString(),
      1
    );

    return toChatMessageResponse(assistantMessage);
  }

  static async deleteSession(
    user: JwtPayload,
    sessionId: string
  ): Promise<void> {
    const session = await this.findSessionOrFail(sessionId, user.sub);
    session.status = Status.DELETED;
    await session.save();
  }

  private static async enrichSessions(
    sessions: InstanceType<typeof ChatSession>[]
  ) {
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s._id);
    const stats = await ChatMessageModel.aggregate<{
      _id: typeof sessionIds[0];
      preview: string;
      messageCount: number;
    }>([
      { $match: { sessionId: { $in: sessionIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sessionId",
          preview: { $first: "$content" },
          messageCount: { $sum: 1 },
        },
      },
    ]);
    const statsMap = new Map(
      stats.map((s) => [
        s._id.toString(),
        {
          preview: s.preview?.slice(0, 80) ?? "",
          messageCount: s.messageCount,
        },
      ])
    );

    return sessions.map((session) => {
      const meta = statsMap.get(session._id.toString());
      return {
        ...toChatSessionResponse(session),
        preview: meta?.preview ?? "",
        messageCount: meta?.messageCount ?? 0,
      };
    });
  }

  private static async findSessionOrFail(sessionId: string, userId: string) {
    const session = await ChatSession.findOne({
      _id: sessionId,
      userId,
      status: Status.ACTIVE,
    });

    if (!session) {
      throw new AppError("Chat session not found", 404);
    }

    return session;
  }

  private static async validateContext(
    input: NormalizedCreateSessionInput
  ): Promise<void> {
    const { organizationId } = input;

    if (input.academicYearId) {
      await AcademicHierarchyService.resolveAcademicYear(
        input.academicYearId,
        organizationId
      );
    }

    if (input.subjectId) {
      await AcademicHierarchyService.resolveSubject(
        input.subjectId,
        organizationId
      );
    }

    if (input.topicId) {
      await AcademicHierarchyService.resolveTopic(input.topicId, organizationId);
    }

    if (input.materialId) {
      const material = await Material.findOne({
        _id: input.materialId,
        organizationId,
        status: Status.ACTIVE,
      });
      if (!material || material.processingStatus !== ProcessingStatus.COMPLETED) {
        throw new AppError("Material not found or not processed", 422);
      }
    }

    if (input.lessonId) {
      const lesson = await Lesson.findOne({
        _id: input.lessonId,
        organizationId,
        status: Status.ACTIVE,
      });
      if (!lesson) {
        throw new AppError("Lesson not found", 404);
      }
      if (
        !lesson.isPersonal &&
        lesson.generationStatus !== ProcessingStatus.COMPLETED
      ) {
        throw new AppError("Lesson not ready for chat", 422);
      }
    }

    if (input.quizId) {
      const quiz = await Quiz.findOne({
        _id: input.quizId,
        organizationId,
        status: Status.ACTIVE,
      });
      if (!quiz || quiz.generationStatus !== ProcessingStatus.COMPLETED) {
        throw new AppError("Quiz not found or not ready", 422);
      }
    }

    if (input.flashcardId) {
      const card = await Flashcard.findOne({
        _id: input.flashcardId,
        organizationId,
        status: Status.ACTIVE,
      });
      if (!card) {
        throw new AppError("Flashcard not found", 404);
      }
    }
  }

  private static async buildInlineContext(
    session: InstanceType<typeof ChatSession>
  ): Promise<string> {
    const parts: string[] = [];

    if (session.flashcardId) {
      const card = await Flashcard.findById(session.flashcardId);
      if (card) {
        parts.push(
          `Flashcard:\nQ: ${card.question}\nA: ${card.answer}\nDifficulty: ${card.difficulty}`
        );
        if (card.lessonId) {
          const lesson = await Lesson.findById(card.lessonId);
          if (lesson?.content) {
            parts.push(`Related lesson:\n${buildLessonContext(lesson)}`);
          }
        }
      }
    }

    if (session.quizId) {
      const quiz = await Quiz.findById(session.quizId);
      const questions = await QuizQuestion.find({
        quizId: session.quizId,
        status: Status.ACTIVE,
      }).limit(20);
      if (quiz) {
        parts.push(`Quiz: ${quiz.title}`);
      }
      if (questions.length > 0) {
        const qText = questions
          .map(
            (q, i) =>
              `${i + 1}. [${q.type}] ${q.question} (answer: ${q.correctAnswer})`
          )
          .join("\n");
        parts.push(`Quiz questions:\n${qText}`);
      }
      if (quiz?.lessonId) {
        const lesson = await Lesson.findById(quiz.lessonId);
        if (lesson?.content) {
          parts.push(`Related lesson:\n${buildLessonContext(lesson)}`);
        }
      }
    }

    if (session.lessonId && !session.quizId && !session.flashcardId) {
      const lesson = await Lesson.findById(session.lessonId);
      if (lesson?.content) {
        parts.push(buildLessonContext(lesson));
      }
    }

    return parts.join("\n\n");
  }

  private static async defaultTitle(
    input: NormalizedCreateSessionInput
  ): Promise<string> {
    if (input.quizId) {
      const quiz = await Quiz.findById(input.quizId);
      return quiz ? `Quiz: ${quiz.title}` : "Quiz Chat";
    }
    if (input.flashcardId) {
      const card = await Flashcard.findById(input.flashcardId);
      return card ? `Flashcard chat` : "Flashcard Chat";
    }
    if (input.lessonId) {
      const lesson = await Lesson.findById(input.lessonId);
      return lesson ? `Chat: ${lesson.title}` : "Lesson Chat";
    }
    if (input.materialId) {
      const material = await Material.findById(input.materialId);
      return material ? `Chat: ${material.title}` : "Material Chat";
    }
    if (input.topicId) {
      const topic = await Topic.findById(input.topicId);
      return topic ? `Chat: ${topic.name}` : "Topic Chat";
    }
    if (input.subjectId) {
      const subject = await Subject.findById(input.subjectId);
      return subject ? `Chat: ${subject.name}` : "Subject Chat";
    }
    if (input.academicYearId) {
      const year = await AcademicYear.findById(input.academicYearId);
      return year ? `Chat: ${year.name}` : "Academic Year Chat";
    }
    return "Organization Chat";
  }
}
