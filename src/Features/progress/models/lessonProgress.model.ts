import mongoose, { Document, Schema, Types } from "mongoose";
import { LessonProgressStatus } from "../../../shared/enums/progress.enum";

export interface ILessonProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId: Types.ObjectId;
  status: LessonProgressStatus;
  progressPercent: number;
  timeSpentMinutes: number;
  completedAt?: Date;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lessonProgressSchema = new Schema<ILessonProgress>(
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
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(LessonProgressStatus),
      default: LessonProgressStatus.NOT_STARTED,
    },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    timeSpentMinutes: { type: Number, default: 0 },
    completedAt: { type: Date },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

const LessonProgress = mongoose.model<ILessonProgress>(
  "LessonProgress",
  lessonProgressSchema
);
export default LessonProgress;
