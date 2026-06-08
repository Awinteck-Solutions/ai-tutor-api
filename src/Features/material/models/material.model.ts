import mongoose, { Document, Schema, Types } from "mongoose";
import { MaterialType } from "../../../shared/enums/materialType.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { MaterialProcessingStage } from "../../../shared/enums/materialProcessingStage.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IMaterial extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  topicId: Types.ObjectId;
  subjectId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  title: string;
  description?: string;
  type: MaterialType;
  processingStatus: ProcessingStatus;
  processingStage: MaterialProcessingStage;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  r2Key?: string;
  r2Url?: string;
  sourceUrl?: string;
  rawText?: string;
  summary?: string;
  chunkCount: number;
  errorMessage?: string;
  jobId?: string;
  tags: string[];
  subjectName?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: Object.values(MaterialType),
      required: true,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: Object.values(ProcessingStatus),
      default: ProcessingStatus.PENDING,
      index: true,
    },
    processingStage: {
      type: String,
      enum: Object.values(MaterialProcessingStage),
      default: MaterialProcessingStage.UPLOADED,
      index: true,
    },
    fileName: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    r2Key: { type: String },
    r2Url: { type: String },
    sourceUrl: { type: String },
    rawText: { type: String, select: false },
    summary: { type: String },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String },
    jobId: { type: String },
    tags: [{ type: String }],
    subjectName: { type: String, trim: true },
    processingStartedAt: { type: Date },
    processingCompletedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

materialSchema.index({ organizationId: 1, processingStatus: 1 });
materialSchema.index({ organizationId: 1, createdAt: -1 });
materialSchema.index({ topicId: 1, createdAt: -1 });
materialSchema.index({ subjectId: 1 });
materialSchema.index({ academicYearId: 1 });

const Material = mongoose.model<IMaterial>("Material", materialSchema);
export default Material;
