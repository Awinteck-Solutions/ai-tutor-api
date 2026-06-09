import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISiteVisit extends Document {
  _id: Types.ObjectId;
  path: string;
  referrer?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
  userAgent?: string;
  userId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  portal?: string;
  createdAt: Date;
}

const siteVisitSchema = new Schema<ISiteVisit>(
  {
    path: { type: String, required: true, index: true },
    referrer: { type: String },
    ipAddress: { type: String, index: true },
    country: { type: String, index: true },
    region: { type: String },
    city: { type: String },
    userAgent: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    portal: { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

siteVisitSchema.index({ createdAt: -1 });
siteVisitSchema.index({ country: 1, createdAt: -1 });

const SiteVisit = mongoose.model<ISiteVisit>("SiteVisit", siteVisitSchema);
export default SiteVisit;
