import mongoose, { Document, Schema, Types } from "mongoose";
import { Status } from "../../../shared/enums/status.enum";

export interface ITopic extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  subjectId: Types.ObjectId;
  name: string;
  description?: string;
  order: number;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopic>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(Status), default: Status.ACTIVE },
  },
  { timestamps: true }
);

topicSchema.index({ subjectId: 1, order: 1 });

const Topic = mongoose.model<ITopic>("Topic", topicSchema);
export default Topic;
