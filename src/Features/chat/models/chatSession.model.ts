import mongoose, { Document, Schema, Types } from "mongoose";
import { ChatContextType } from "../../../shared/enums/chat.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IChatSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  title: string;
  contextType: ChatContextType;
  academicYearId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  topicId?: Types.ObjectId;
  materialId?: Types.ObjectId;
  lessonId?: Types.ObjectId;
  quizId?: Types.ObjectId;
  flashcardId?: Types.ObjectId;
  lastMessageAt?: Date;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, default: "New Chat", trim: true },
    contextType: {
      type: String,
      enum: Object.values(ChatContextType),
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", index: true },
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", index: true },
    flashcardId: { type: Schema.Types.ObjectId, ref: "Flashcard", index: true },
    lastMessageAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

const ChatSession = mongoose.model<IChatSession>(
  "ChatSession",
  chatSessionSchema
);
export default ChatSession;
