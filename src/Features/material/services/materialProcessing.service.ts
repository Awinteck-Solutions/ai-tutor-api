import { v4 as uuidv4 } from "uuid";
import { env } from "../../../config/env";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { MaterialProcessingStage } from "../../../shared/enums/materialProcessingStage.enum";
import { MaterialType } from "../../../shared/enums/materialType.enum";
import { PROMPTS } from "../../../services/ai/prompt.templates";
import { AIService } from "../../../services/ai/ai.service";
import { ChunkingService } from "../../../services/processing/chunking.service";
import { TextExtractorService } from "../../../services/processing/textExtractor.service";
import {
  EMBEDDING_BATCH_SIZE,
  QDRANT_COLLECTION,
} from "../../../services/qdrant/qdrant.constants";
import { QdrantService } from "../../../services/qdrant/qdrant.service";
import { UsageLimitService } from "../../../shared/services/usageLimit.service";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationType } from "../../../shared/enums/notificationType.enum";
import Material from "../models/material.model";
import MaterialChunk from "../models/materialChunk.model";
import MaterialProcessingLog from "../models/materialProcessingLog.model";

export class MaterialProcessingService {
  private static async logStage(
    materialId: string,
    organizationId: string,
    stage: MaterialProcessingStage,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await MaterialProcessingLog.create({
      materialId,
      organizationId,
      stage,
      message,
      metadata,
    });
    await Material.findByIdAndUpdate(materialId, { processingStage: stage });
  }

  static async process(materialId: string): Promise<void> {
    const material = await Material.findById(materialId);
    if (!material) {
      throw new Error(`Material ${materialId} not found`);
    }

    material.processingStatus = ProcessingStatus.PROCESSING;
    material.processingStage = MaterialProcessingStage.PROCESSING;
    material.processingStartedAt = new Date();
    material.errorMessage = undefined;
    await material.save();
    await this.logStage(
      materialId,
      material.organizationId.toString(),
      MaterialProcessingStage.PROCESSING,
      "Processing started"
    );

    try {
      await UsageLimitService.assertWithinLimits(material.organizationId.toString());

      const text = await TextExtractorService.extract(material);
      material.rawText = text;
      await material.save();

      await this.logStage(
        materialId,
        material.organizationId.toString(),
        MaterialProcessingStage.CHUNKING,
        "Text extracted, starting chunking"
      );

      await MaterialChunk.deleteMany({ materialId: material._id });
      await QdrantService.deleteMaterialVectors(material._id.toString());

      const chunks = ChunkingService.chunkText(text);
      if (chunks.length === 0) {
        throw new Error("No content chunks generated from material");
      }

      await QdrantService.ensureCollection(
        QDRANT_COLLECTION,
        env.ai.embeddingDimensions
      );

      await this.logStage(
        materialId,
        material.organizationId.toString(),
        MaterialProcessingStage.EMBEDDING,
        `Chunking complete — ${chunks.length} chunks`
      );

      const sourceType =
        material.type === MaterialType.PDF
          ? "pdf"
          : material.type === MaterialType.YOUTUBE
            ? "youtube"
            : "text";

      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const embeddings = await AIService.generateEmbeddings(
          batch.map((c) => c.content),
          {
            organizationId: material.organizationId.toString(),
            operation: "embedding",
          }
        );

        const vectorPoints = batch.map((chunk, idx) => {
          const pointId = uuidv4();
          return {
            point: {
              id: pointId,
              vector: embeddings[idx],
              payload: {
                organizationId: material.organizationId.toString(),
                academicYearId: material.academicYearId.toString(),
                subjectId: material.subjectId.toString(),
                topicId: material.topicId.toString(),
                courseId: material.subjectId.toString(),
                lessonId: "",
                materialId: material._id.toString(),
                chunkIndex: chunk.index,
                page: Math.floor(chunk.index / 3) + 1,
                sourceType,
                title: material.title,
                subjectName: material.subjectName ?? "",
                content: chunk.content.slice(0, 500),
              },
            },
            chunk,
            pointId,
          };
        });

        await QdrantService.upsertPoints(
          QDRANT_COLLECTION,
          vectorPoints.map((v) => v.point)
        );

        await MaterialChunk.insertMany(
          vectorPoints.map((v) => ({
            materialId: material._id,
            organizationId: material.organizationId,
            chunkIndex: v.chunk.index,
            content: v.chunk.content,
            startChar: v.chunk.startChar,
            endChar: v.chunk.endChar,
            qdrantPointId: v.pointId,
          }))
        );
      }

      await this.logStage(
        materialId,
        material.organizationId.toString(),
        MaterialProcessingStage.GENERATING,
        "Embeddings indexed, generating summary"
      );

      const summaryInput = text.slice(0, 12000);
      const summary = await AIService.chat(
        [
          { role: "user", content: PROMPTS.summaryGeneration(summaryInput) },
        ],
        { organizationId: material.organizationId.toString(), operation: "material_summary" }
      );

      material.summary = summary;
      material.chunkCount = chunks.length;
      material.processingStatus = ProcessingStatus.COMPLETED;
      material.processingStage = MaterialProcessingStage.COMPLETED;
      material.processingCompletedAt = new Date();
      await material.save();

      await this.logStage(
        materialId,
        material.organizationId.toString(),
        MaterialProcessingStage.COMPLETED,
        `Processing completed — ${chunks.length} chunks indexed`
      );

      await NotificationService.create({
        userId: material.uploadedBy.toString(),
        organizationId: material.organizationId.toString(),
        type: NotificationType.MATERIAL_PROCESSED,
        title: "Material processed",
        body: `"${material.title}" is ready for lesson generation.`,
        data: { materialId: material._id.toString() },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";

      material.processingStatus = ProcessingStatus.FAILED;
      material.processingStage = MaterialProcessingStage.FAILED;
      material.errorMessage = message;
      material.processingCompletedAt = new Date();
      await material.save();

      await this.logStage(
        materialId,
        material.organizationId.toString(),
        MaterialProcessingStage.FAILED,
        message
      );

      throw error;
    }
  }
}
