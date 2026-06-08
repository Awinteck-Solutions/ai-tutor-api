import mongoose, { Document, Schema, Types } from "mongoose";
import { SubscriptionPlan } from "../../../shared/enums/subscriptionPlan.enum";
import { Status } from "../../../shared/enums/status.enum";

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo?: string;
  subscriptionPlan: SubscriptionPlan;
  isPersonalWorkspace?: boolean;
  ownerId: Types.ObjectId;
  teachers: Types.ObjectId[];
  students: Types.ObjectId[];
  parents: Types.ObjectId[];
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    logo: { type: String },
    subscriptionPlan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.FREE,
    },
    isPersonalWorkspace: { type: Boolean, default: false, index: true },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teachers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    parents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema
);
export default Organization;
