import mongoose, { Document, Schema, Types } from "mongoose";

export interface IStudentProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonsCompleted: number;
  quizzesTaken: number;
  totalQuizScore: number;
  flashcardsReviewed: number;
  flashcardsCorrect: number;
  totalStudyTimeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: Date;
  weakTopics: string[];
  totalXp: number;
  createdAt: Date;
  updatedAt: Date;
}

const studentProgressSchema = new Schema<IStudentProgress>(
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
    lessonsCompleted: { type: Number, default: 0 },
    quizzesTaken: { type: Number, default: 0 },
    totalQuizScore: { type: Number, default: 0 },
    flashcardsReviewed: { type: Number, default: 0 },
    flashcardsCorrect: { type: Number, default: 0 },
    totalStudyTimeMinutes: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastStudyDate: { type: Date },
    weakTopics: [{ type: String }],
    totalXp: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

studentProgressSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

const StudentProgress = mongoose.model<IStudentProgress>(
  "StudentProgress",
  studentProgressSchema
);
export default StudentProgress;
