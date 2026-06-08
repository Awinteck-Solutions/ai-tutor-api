import mongoose, { Document, Schema, Types } from "mongoose";

export interface IStudentNote extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId?: Types.ObjectId;
  quizId?: Types.ObjectId;
  flashcardId?: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentNoteSchema = new Schema<IStudentNote>(
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
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", index: true },
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", index: true },
    flashcardId: { type: Schema.Types.ObjectId, ref: "Flashcard", index: true },
    title: { type: String, default: "My notes", trim: true },
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

studentNoteSchema.index({ userId: 1, lessonId: 1 });
studentNoteSchema.index({ userId: 1, quizId: 1 });
studentNoteSchema.index({ userId: 1, flashcardId: 1 });

const StudentNote = mongoose.model<IStudentNote>(
  "StudentNote",
  studentNoteSchema
);
export default StudentNote;
