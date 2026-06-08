import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface ICourseEnrollment extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: Status;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const courseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: Object.values(Status), default: Status.ACTIVE },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

courseEnrollmentSchema.index({ subjectId: 1, studentId: 1 }, { unique: true });

const CourseEnrollment = mongoose.model<ICourseEnrollment>(
  "CourseEnrollment",
  courseEnrollmentSchema
);
export default CourseEnrollment;
