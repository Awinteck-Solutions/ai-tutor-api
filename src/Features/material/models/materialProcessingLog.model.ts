import mongoose, { Document, Schema, Types } from "mongoose";
import { MaterialProcessingStage } from "../../../shared/enums/materialProcessingStage.enum";

export interface IMaterialProcessingLog extends Document {
  _id: Types.ObjectId;
  materialId: Types.ObjectId;
  organizationId: Types.ObjectId;
  stage: MaterialProcessingStage;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const materialProcessingLogSchema = new Schema<IMaterialProcessingLog>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    stage: {
      type: String,
      enum: Object.values(MaterialProcessingStage),
      required: true,
    },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

materialProcessingLogSchema.index({ materialId: 1, createdAt: 1 });

const MaterialProcessingLog = mongoose.model<IMaterialProcessingLog>(
  "MaterialProcessingLog",
  materialProcessingLogSchema
);
export default MaterialProcessingLog;
