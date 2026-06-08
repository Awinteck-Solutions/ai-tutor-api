import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuizDraftAnswer {
  questionId: Types.ObjectId;
  answer: string;
}

export interface IQuizDraft extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  quizId: Types.ObjectId;
  lessonId: Types.ObjectId;
  answers: IQuizDraftAnswer[];
  currentStep: number;
  updatedAt: Date;
  createdAt: Date;
}

const quizDraftSchema = new Schema<IQuizDraft>(
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
    },
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: "QuizQuestion" },
        answer: { type: String, default: "" },
      },
    ],
    currentStep: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

quizDraftSchema.index({ userId: 1, quizId: 1 }, { unique: true });

const QuizDraft = mongoose.model<IQuizDraft>("QuizDraft", quizDraftSchema);
export default QuizDraft;
