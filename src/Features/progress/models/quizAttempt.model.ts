import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuizAnswer {
  questionId: Types.ObjectId;
  answer: string;
  isCorrect: boolean;
}

export interface IQuizAttempt extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  quizId: Types.ObjectId;
  lessonId: Types.ObjectId;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  answers: IQuizAnswer[];
  timeSpentSeconds: number;
  completedAt: Date;
  createdAt: Date;
}

const quizAttemptSchema = new Schema<IQuizAttempt>(
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
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: "QuizQuestion" },
        answer: { type: String },
        isCorrect: { type: Boolean },
      },
    ],
    timeSpentSeconds: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quizAttemptSchema.index({ userId: 1, quizId: 1, completedAt: -1 });

const QuizAttempt = mongoose.model<IQuizAttempt>(
  "QuizAttempt",
  quizAttemptSchema
);
export default QuizAttempt;
