import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILessonMaterial extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  lessonId: Types.ObjectId;
  materialId: Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const lessonMaterialSchema = new Schema<ILessonMaterial>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
      index: true,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

lessonMaterialSchema.index({ lessonId: 1, materialId: 1 }, { unique: true });
lessonMaterialSchema.index({ lessonId: 1, order: 1 });

const LessonMaterial = mongoose.model<ILessonMaterial>(
  "LessonMaterial",
  lessonMaterialSchema
);
export default LessonMaterial;
