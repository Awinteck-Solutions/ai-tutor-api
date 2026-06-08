import mongoose from "mongoose";
import { ChatContextType } from "../../../shared/enums/chat.enum";
import { IChatMessage, IChatSource } from "../models/chatMessage.model";
import { IChatSession } from "../models/chatSession.model";

export interface CreateSessionInput {
  organizationId: string;
  contextType?: ChatContextType;
  academicYearId?: string;
  subjectId?: string;
  topicId?: string;
  materialId?: string;
  lessonId?: string;
  quizId?: string;
  flashcardId?: string;
  title?: string;
}

export interface NormalizedCreateSessionInput {
  organizationId: string;
  contextType: ChatContextType;
  academicYearId?: string;
  subjectId?: string;
  topicId?: string;
  materialId?: string;
  lessonId?: string;
  quizId?: string;
  flashcardId?: string;
  title?: string;
}

function sanitizeMongoId(value: unknown): string | undefined {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) {
    return undefined;
  }
  return value;
}

function inferContextType(scope: {
  lessonId?: string;
  quizId?: string;
  flashcardId?: string;
  materialId?: string;
  topicId?: string;
  subjectId?: string;
  academicYearId?: string;
}): ChatContextType {
  if (scope.quizId) return ChatContextType.QUIZ;
  if (scope.flashcardId) return ChatContextType.FLASHCARD;
  if (scope.lessonId) return ChatContextType.LESSON;
  if (scope.materialId) return ChatContextType.MATERIAL;
  if (scope.topicId) return ChatContextType.TOPIC;
  if (scope.subjectId) return ChatContextType.SUBJECT;
  if (scope.academicYearId) return ChatContextType.ACADEMIC_YEAR;
  return ChatContextType.ORGANIZATION;
}

export function normalizeCreateSessionInput(
  raw: CreateSessionInput
): NormalizedCreateSessionInput {
  const scope = {
    academicYearId: sanitizeMongoId(raw.academicYearId),
    subjectId: sanitizeMongoId(raw.subjectId),
    topicId: sanitizeMongoId(raw.topicId),
    materialId: sanitizeMongoId(raw.materialId),
    lessonId: sanitizeMongoId(raw.lessonId),
    quizId: sanitizeMongoId(raw.quizId),
    flashcardId: sanitizeMongoId(raw.flashcardId),
  };

  const inferredContextType = inferContextType(scope);
  const contextType =
    inferredContextType !== ChatContextType.ORGANIZATION
      ? inferredContextType
      : raw.contextType &&
          Object.values(ChatContextType).includes(raw.contextType)
        ? raw.contextType
        : ChatContextType.ORGANIZATION;

  const title = raw.title?.trim();

  return {
    organizationId: raw.organizationId,
    contextType,
    ...scope,
    title: title || undefined,
  };
}

export interface SendMessageInput {
  message: string;
}

export interface ChatSessionResponse {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  contextType: ChatContextType;
  academicYearId?: string;
  subjectId?: string;
  topicId?: string;
  materialId?: string;
  lessonId?: string;
  quizId?: string;
  flashcardId?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatCitation {
  materialId: string;
  materialName: string;
  page: number;
  chunkIndex: number;
  score: number;
  preview: string;
}

export interface ChatMessageResponse {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  answer?: string;
  citations: ChatCitation[];
  sources: ChatCitation[];
  createdAt: Date;
}

export function toChatSessionResponse(session: IChatSession): ChatSessionResponse {
  return {
    id: session._id.toString(),
    userId: session.userId.toString(),
    organizationId: session.organizationId.toString(),
    title: session.title,
    contextType: session.contextType,
    academicYearId: session.academicYearId?.toString(),
    subjectId: session.subjectId?.toString(),
    topicId: session.topicId?.toString(),
    materialId: session.materialId?.toString(),
    lessonId: session.lessonId?.toString(),
    quizId: session.quizId?.toString(),
    flashcardId: session.flashcardId?.toString(),
    lastMessageAt: session.lastMessageAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function toCitations(sources: IChatSource[]): ChatCitation[] {
  return (sources ?? []).map((s) => ({
    materialId: s.materialId,
    materialName: s.materialName ?? "Source",
    page: s.page ?? Math.floor(s.chunkIndex / 3) + 1,
    chunkIndex: s.chunkIndex,
    score: s.score,
    preview: s.preview,
  }));
}

export function toChatMessageResponse(message: IChatMessage): ChatMessageResponse {
  const citations = toCitations(message.sources);
  return {
    id: message._id.toString(),
    sessionId: message.sessionId.toString(),
    role: message.role,
    content: message.content,
    answer: message.role === "ASSISTANT" ? message.content : undefined,
    citations,
    sources: citations,
    createdAt: message.createdAt,
  };
}
