import mongoose, { Document, Schema, Types } from "mongoose";
import { XpSourceType } from "../../../shared/enums/xpSourceType.enum";

export interface IXpAward extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  sourceType: XpSourceType;
  sourceId: Types.ObjectId;
  xpAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const xpAwardSchema = new Schema<IXpAward>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: Object.values(XpSourceType),
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    xpAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

xpAwardSchema.index(
  { userId: 1, organizationId: 1, sourceType: 1, sourceId: 1 },
  { unique: true }
);

const XpAward = mongoose.model<IXpAward>("XpAward", xpAwardSchema);
export default XpAward;
