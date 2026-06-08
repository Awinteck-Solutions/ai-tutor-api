import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface ISubject extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  termId?: Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  teacherIds: Types.ObjectId[];
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true, index: true },
    termId: { type: Schema.Types.ObjectId, ref: "Term", index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String },
    teacherIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(Status), default: Status.ACTIVE },
  },
  { timestamps: true }
);

subjectSchema.index({ organizationId: 1, academicYearId: 1, name: 1 });

const Subject = mongoose.model<ISubject>("Subject", subjectSchema);
export default Subject;
