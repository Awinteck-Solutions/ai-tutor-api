import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFlashcardProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  flashcardId: Types.ObjectId;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  confidenceScore: number;
  masteryLevel: number;
  lastReviewedAt?: Date;
  nextReviewAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const flashcardProgressSchema = new Schema<IFlashcardProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    flashcardId: { type: Schema.Types.ObjectId, ref: "Flashcard", required: true, index: true },
    easeFactor: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 1 },
    repetitions: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0, min: 0, max: 100 },
    masteryLevel: { type: Number, default: 0, min: 0, max: 5 },
    lastReviewedAt: { type: Date },
    nextReviewAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

flashcardProgressSchema.index({ userId: 1, flashcardId: 1 }, { unique: true });
flashcardProgressSchema.index({ userId: 1, nextReviewAt: 1 });

const FlashcardProgress = mongoose.model<IFlashcardProgress>(
  "FlashcardProgress",
  flashcardProgressSchema
);
export default FlashcardProgress;
