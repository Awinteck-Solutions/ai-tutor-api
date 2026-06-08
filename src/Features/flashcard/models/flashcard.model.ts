import mongoose, { Document, Schema, Types } from "mongoose";
import { Difficulty } from "../../../shared/enums/difficulty.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IFlashcard extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId: Types.ObjectId;
  flashcardSetId?: Types.ObjectId;
  question: string;
  answer: string;
  difficulty: Difficulty;
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const flashcardSchema = new Schema<IFlashcard>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    flashcardSetId: {
      type: Schema.Types.ObjectId,
      ref: "FlashcardSet",
      index: true,
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    difficulty: {
      type: String,
      enum: Object.values(Difficulty),
      default: Difficulty.MEDIUM,
    },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true }
);

flashcardSchema.index({ lessonId: 1, order: 1 });

const Flashcard = mongoose.model<IFlashcard>("Flashcard", flashcardSchema);
export default Flashcard;
