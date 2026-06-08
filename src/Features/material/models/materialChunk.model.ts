import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMaterialChunk extends Document {
  _id: Types.ObjectId;
  materialId: Types.ObjectId;
  organizationId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  startChar: number;
  endChar: number;
  qdrantPointId: string;
  createdAt: Date;
}

const materialChunkSchema = new Schema<IMaterialChunk>(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    startChar: { type: Number, required: true },
    endChar: { type: Number, required: true },
    qdrantPointId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

materialChunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true });

const MaterialChunk = mongoose.model<IMaterialChunk>(
  "MaterialChunk",
  materialChunkSchema
);
export default MaterialChunk;
