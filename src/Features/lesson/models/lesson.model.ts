import mongoose, { Document, Schema, Types } from "mongoose";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface ILesson extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  /** @deprecated Legacy single-material lessons */
  materialId?: Types.ObjectId;
  topicId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  academicYearId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  /** Student-created self-study lesson (visible only to owner + org admins) */
  isPersonal?: boolean;
  ownerId?: Types.ObjectId;
  title: string;
  summary?: string;
  objectives: string[];
  concepts: string[];
  examples: string[];
  references: string[];
  content?: string;
  order: number;
  generationStatus: ProcessingStatus;
  errorMessage?: string;
  jobId?: string;
  flashcardsGenerated: boolean;
  quizGenerated: boolean;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      index: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPersonal: { type: Boolean, default: false, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String },
    objectives: [{ type: String }],
    concepts: [{ type: String }],
    examples: [{ type: String }],
    references: [{ type: String }],
    content: { type: String },
    order: { type: Number, default: 0 },
    generationStatus: {
      type: String,
      enum: Object.values(ProcessingStatus),
      default: ProcessingStatus.PENDING,
      index: true,
    },
    errorMessage: { type: String },
    jobId: { type: String },
    flashcardsGenerated: { type: Boolean, default: false },
    quizGenerated: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

lessonSchema.index({ organizationId: 1, topicId: 1, order: 1 });
lessonSchema.index({ organizationId: 1, createdAt: -1 });

const Lesson = mongoose.model<ILesson>("Lesson", lessonSchema);
export default Lesson;
