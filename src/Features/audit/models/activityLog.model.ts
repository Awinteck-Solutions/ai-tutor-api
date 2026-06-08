import mongoose, { Document, Schema, Types } from "mongoose";
import { ActivityType } from "../../../shared/enums/activityType.enum";

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  organizationId?: Types.ObjectId;
  userId?: Types.ObjectId;
  activityType: ActivityType;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    activityType: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
      index: true,
    },
    resourceType: { type: String },
    resourceId: { type: String },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ organizationId: 1, createdAt: -1 });

const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);
export default ActivityLog;
