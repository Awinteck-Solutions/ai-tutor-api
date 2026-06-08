import mongoose, { Document, Schema, Types } from "mongoose";
import { FlashcardReviewResult } from "../../../shared/enums/progress.enum";
import { Difficulty } from "../../../shared/enums/difficulty.enum";

export interface IFlashcardReview extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  flashcardId: Types.ObjectId;
  lessonId: Types.ObjectId;
  result: FlashcardReviewResult;
  difficulty: Difficulty;
  reviewedAt: Date;
  createdAt: Date;
}

const flashcardReviewSchema = new Schema<IFlashcardReview>(
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
    flashcardId: {
      type: Schema.Types.ObjectId,
      ref: "Flashcard",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: Object.values(FlashcardReviewResult),
      required: true,
    },
    difficulty: {
      type: String,
      enum: Object.values(Difficulty),
      required: true,
    },
    reviewedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

flashcardReviewSchema.index({ userId: 1, flashcardId: 1, reviewedAt: -1 });

const FlashcardReview = mongoose.model<IFlashcardReview>(
  "FlashcardReview",
  flashcardReviewSchema
);
export default FlashcardReview;
