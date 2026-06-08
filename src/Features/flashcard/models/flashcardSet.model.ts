import mongoose, { Document, Schema, Types } from "mongoose";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IFlashcardSet extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId: Types.ObjectId;
  title: string;
  difficulty?: string;
  setLabel?: string;
  cardCount: number;
  generationStatus: ProcessingStatus;
  errorMessage?: string;
  jobId?: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const flashcardSetSchema = new Schema<IFlashcardSet>(
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
    title: { type: String, required: true, trim: true },
    difficulty: { type: String, trim: true },
    setLabel: { type: String, trim: true },
    cardCount: { type: Number, default: 0 },
    generationStatus: {
      type: String,
      enum: Object.values(ProcessingStatus),
      default: ProcessingStatus.PENDING,
      index: true,
    },
    errorMessage: { type: String },
    jobId: { type: String },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true }
);

flashcardSetSchema.index({ lessonId: 1, createdAt: -1 });

const FlashcardSet = mongoose.model<IFlashcardSet>(
  "FlashcardSet",
  flashcardSetSchema
);
export default FlashcardSet;
