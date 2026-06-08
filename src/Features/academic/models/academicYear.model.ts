import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface IAcademicYear extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const academicYearSchema = new Schema<IAcademicYear>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false, index: true },
    status: { type: String, enum: Object.values(Status), default: Status.ACTIVE },
  },
  { timestamps: true }
);

academicYearSchema.index({ organizationId: 1, name: 1 }, { unique: true });

const AcademicYear = mongoose.model<IAcademicYear>("AcademicYear", academicYearSchema);
export default AcademicYear;
