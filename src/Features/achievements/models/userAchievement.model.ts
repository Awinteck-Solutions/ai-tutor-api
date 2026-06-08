import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUserAchievement extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  achievementId: string;
  title: string;
  unlockedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    achievementId: { type: String, required: true },
    title: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userAchievementSchema.index(
  { userId: 1, organizationId: 1, achievementId: 1 },
  { unique: true }
);

const UserAchievement = mongoose.model<IUserAchievement>(
  "UserAchievement",
  userAchievementSchema
);
export default UserAchievement;
