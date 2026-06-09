import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface ILessonGroup extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const lessonGroupSchema = new Schema<ILessonGroup>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

lessonGroupSchema.index({ organizationId: 1, ownerId: 1, order: 1 });

const LessonGroup = mongoose.model<ILessonGroup>("LessonGroup", lessonGroupSchema);
export default LessonGroup;
