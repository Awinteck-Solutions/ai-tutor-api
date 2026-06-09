import mongoose, { Document, Schema } from "mongoose";
import {
  ServiceComponent,
  ServiceHealthStatus,
} from "../../../shared/enums/serviceComponent.enum";

export interface IServiceHealthCheck extends Document {
  component: ServiceComponent;
  status: ServiceHealthStatus;
  latencyMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const serviceHealthCheckSchema = new Schema<IServiceHealthCheck>(
  {
    component: {
      type: String,
      enum: Object.values(ServiceComponent),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ServiceHealthStatus),
      required: true,
      index: true,
    },
    latencyMs: { type: Number },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

serviceHealthCheckSchema.index({ component: 1, createdAt: -1 });

const ServiceHealthCheck = mongoose.model<IServiceHealthCheck>(
  "ServiceHealthCheck",
  serviceHealthCheckSchema
);
export default ServiceHealthCheck;
