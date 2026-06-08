import mongoose, { Document, Schema, Types } from "mongoose";
import { ChatMessageRole } from "../../../shared/enums/chat.enum";

export interface IChatSource {
  materialId: string;
  materialName?: string;
  chunkIndex: number;
  page?: number;
  score: number;
  preview: string;
}

export interface IChatMessage extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  role: ChatMessageRole;
  content: string;
  sources: IChatSource[];
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ChatMessageRole),
      required: true,
    },
    content: { type: String, required: true },
    sources: [
      {
        materialId: { type: String },
        materialName: { type: String },
        chunkIndex: { type: Number },
        page: { type: Number },
        score: { type: Number },
        preview: { type: String },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const ChatMessage = mongoose.model<IChatMessage>(
  "ChatMessage",
  chatMessageSchema
);
export default ChatMessage;
