import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface ITerm extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const termSchema = new Schema<ITerm>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(Status), default: Status.ACTIVE },
  },
  { timestamps: true }
);

termSchema.index({ academicYearId: 1, name: 1 }, { unique: true });

const Term = mongoose.model<ITerm>("Term", termSchema);
export default Term;
