import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../enums/status.enum";

export interface IParentStudentLink extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  parentId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const parentStudentLinkSchema = new Schema<IParentStudentLink>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    parentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
  },
  { timestamps: true }
);

parentStudentLinkSchema.index(
  { organizationId: 1, parentId: 1, studentId: 1 },
  { unique: true }
);

const ParentStudentLink = mongoose.model<IParentStudentLink>(
  "ParentStudentLink",
  parentStudentLinkSchema
);
export default ParentStudentLink;
