import mongoose, { Document, Schema, Types } from "mongoose";
import { InvoiceStatus } from "../../../shared/enums/invoiceStatus.enum";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";

export interface IPlatformInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  description?: string;
  notes?: string;
  dueDate?: Date;
  paidAt?: Date;
  issuedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const platformInvoiceSchema = new Schema<IPlatformInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.DRAFT,
      index: true,
    },
    description: { type: String },
    notes: { type: String },
    dueDate: { type: Date },
    paidAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PlatformInvoice = mongoose.model<IPlatformInvoice>(
  "PlatformInvoice",
  platformInvoiceSchema
);
export default PlatformInvoice;
