import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAIUsageLog extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  operation: string;
  tokensUsed: number;
  requestCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const aiUsageLogSchema = new Schema<IAIUsageLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    operation: { type: String, required: true, index: true },
    tokensUsed: { type: Number, default: 0 },
    requestCount: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiUsageLogSchema.index({ organizationId: 1, createdAt: -1 });

const AIUsageLog = mongoose.model<IAIUsageLog>("AIUsageLog", aiUsageLogSchema);
export default AIUsageLog;
