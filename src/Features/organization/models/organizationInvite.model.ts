import mongoose, { Document, Schema, Types } from "mongoose";
import { Role } from "../../../shared/enums/roles.enum";
import { InviteStatus } from "../../../shared/enums/inviteStatus.enum";

export interface IOrganizationInvite extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  role: Role.TEACHER | Role.STUDENT | Role.PARENT;
  token: string;
  invitedBy: Types.ObjectId;
  status: InviteStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const organizationInviteSchema = new Schema<IOrganizationInvite>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: {
      type: String,
      enum: [Role.TEACHER, Role.STUDENT, Role.PARENT],
      required: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(InviteStatus),
      default: InviteStatus.PENDING,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

organizationInviteSchema.index({ organizationId: 1, email: 1, status: 1 });

const OrganizationInvite = mongoose.model<IOrganizationInvite>(
  "OrganizationInvite",
  organizationInviteSchema
);
export default OrganizationInvite;
