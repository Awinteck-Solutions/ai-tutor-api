import mongoose, { Document, Schema, Types } from "mongoose";
import { Difficulty } from "../../../shared/enums/difficulty.enum";
import { QuizQuestionType } from "../../../shared/enums/quizQuestionType.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IQuizQuestion extends Document {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  lessonId: Types.ObjectId;
  type: QuizQuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: Difficulty;
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const quizQuestionSchema = new Schema<IQuizQuestion>(
  {
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
    type: {
      type: String,
      enum: Object.values(QuizQuestionType),
      required: true,
    },
    question: { type: String, required: true },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, default: "" },
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

quizQuestionSchema.index({ quizId: 1, order: 1 });

const QuizQuestion = mongoose.model<IQuizQuestion>(
  "QuizQuestion",
  quizQuestionSchema
);
export default QuizQuestion;
