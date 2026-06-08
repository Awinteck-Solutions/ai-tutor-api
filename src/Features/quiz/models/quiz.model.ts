import mongoose, { Document, Schema, Types } from "mongoose";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IQuiz extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId: Types.ObjectId;
  title: string;
  difficulty?: string;
  /** e.g. "Quick · 5 questions · Easy" */
  setLabel?: string;
  questionCount: number;
  generationStatus: ProcessingStatus;
  errorMessage?: string;
  jobId?: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const quizSchema = new Schema<IQuiz>(
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
    questionCount: { type: Number, default: 0 },
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

quizSchema.index({ lessonId: 1, createdAt: -1 });

const Quiz = mongoose.model<IQuiz>("Quiz", quizSchema);
export default Quiz;
