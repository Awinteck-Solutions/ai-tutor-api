import { EmbeddingService } from "../processing/embedding.service";
import { QdrantService } from "../qdrant/qdrant.service";
import { QDRANT_COLLECTION } from "../qdrant/qdrant.constants";
import { AppError } from "../../shared/errors/AppError";
import {
  buildLessonContext,
  getLessonMaterialIds,
} from "../../shared/services/content.service";
import Material from "../../Features/material/models/material.model";
import MaterialChunk from "../../Features/material/models/materialChunk.model";
import Lesson from "../../Features/lesson/models/lesson.model";
import { ProcessingStatus } from "../../shared/enums/processingStatus.enum";
import { Status } from "../../shared/enums/status.enum";

export interface RetrievedChunk {
  materialId: string;
  chunkIndex: number;
  content: string;
  score: number;
  title?: string;
  page?: number;
}

export interface RAGContext {
  chunks: RetrievedChunk[];
  lessonContext?: string;
  combinedText: string;
}

export interface RAGRetrieveParams {
  query: string;
  organizationId: string;
  limit?: number;
  materialId?: string;
  materialIds?: string[];
  lessonId?: string;
  topicId?: string;
  subjectId?: string;
  academicYearId?: string;
}

export class RAGService {
  static async retrieve(params: RAGRetrieveParams): Promise<RAGContext> {
    const { query, organizationId, limit = 8 } = params;

    QdrantService.assertConfigured();

    let lessonContext: string | undefined;
    let materialIds = params.materialIds ?? [];

    if (params.lessonId) {
      const lesson = await Lesson.findById(params.lessonId);
      if (!lesson || lesson.generationStatus !== ProcessingStatus.COMPLETED) {
        throw new AppError("Lesson not found or not ready", 404);
      }
      materialIds = await getLessonMaterialIds(params.lessonId);
      lessonContext = buildLessonContext(lesson);
    } else if (params.materialId) {
      materialIds = [params.materialId];
    }

    const filter = await this.buildFilter({
      organizationId,
      materialIds,
      topicId: params.topicId,
      subjectId: params.subjectId,
      academicYearId: params.academicYearId,
    });

    const queryVector = await EmbeddingService.generate(query);

    let chunks: RetrievedChunk[] = [];

    try {
      const results = await QdrantService.search(
        QDRANT_COLLECTION,
        queryVector,
        limit,
        filter
      );

      chunks = results.map((r) => ({
        materialId: String(r.payload.materialId ?? ""),
        chunkIndex: Number(r.payload.chunkIndex ?? 0),
        content: String(r.payload.content ?? ""),
        score: r.score,
        title: r.payload.title ? String(r.payload.title) : undefined,
        page: r.payload.page ? Number(r.payload.page) : undefined,
      }));
    } catch (error) {
      console.warn("[RAG] Qdrant search failed, falling back to MongoDB:", error);
      chunks = await this.fallbackChunks(
        organizationId,
        materialIds,
        params.topicId,
        params.subjectId,
        params.academicYearId,
        limit
      );
    }

    if (chunks.length === 0) {
      chunks = await this.fallbackChunks(
        organizationId,
        materialIds,
        params.topicId,
        params.subjectId,
        params.academicYearId,
        limit
      );
    }

    const chunkText = chunks
      .map((c, i) => `[Source ${i + 1}] ${c.title ? `(${c.title}) ` : ""}${c.content}`)
      .join("\n\n");

    const combinedText = [lessonContext, chunkText].filter(Boolean).join("\n\n---\n\n");

    if (!combinedText.trim()) {
      throw new AppError(
        "No educational context available for this scope. Ensure materials are processed.",
        422
      );
    }

    return { chunks, lessonContext, combinedText };
  }

  private static async buildFilter(params: {
    organizationId: string;
    materialIds: string[];
    topicId?: string;
    subjectId?: string;
    academicYearId?: string;
  }): Promise<Record<string, unknown>> {
    const must: Record<string, unknown>[] = [
      { key: "organizationId", match: { value: params.organizationId } },
    ];

    if (params.materialIds.length === 1) {
      must.push({
        key: "materialId",
        match: { value: params.materialIds[0] },
      });
    } else if (params.materialIds.length > 1) {
      must.push({
        should: params.materialIds.map((id) => ({
          key: "materialId",
          match: { value: id },
        })),
      });
    }

    if (params.topicId) {
      must.push({ key: "topicId", match: { value: params.topicId } });
    }
    if (params.subjectId) {
      must.push({ key: "subjectId", match: { value: params.subjectId } });
    }
    if (params.academicYearId) {
      must.push({
        key: "academicYearId",
        match: { value: params.academicYearId },
      });
    }

    return { must };
  }

  private static async fallbackChunks(
    organizationId: string,
    materialIds: string[],
    topicId: string | undefined,
    subjectId: string | undefined,
    academicYearId: string | undefined,
    limit: number
  ): Promise<RetrievedChunk[]> {
    const materialFilter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
      processingStatus: ProcessingStatus.COMPLETED,
    };

    if (materialIds.length > 0) {
      materialFilter._id = { $in: materialIds };
    }
    if (topicId) {
      materialFilter.topicId = topicId;
    }
    if (subjectId) {
      materialFilter.subjectId = subjectId;
    }
    if (academicYearId) {
      materialFilter.academicYearId = academicYearId;
    }

    const materials = await Material.find(materialFilter).limit(20).select("_id title");
    if (materials.length === 0) return [];

    const ids = materials.map((m) => m._id);
    const dbChunks = await MaterialChunk.find({ materialId: { $in: ids } })
      .sort({ chunkIndex: 1 })
      .limit(limit);

    if (dbChunks.length > 0) {
      const titleMap = new Map(materials.map((m) => [m._id.toString(), m.title]));
      return dbChunks.map((c) => ({
        materialId: c.materialId.toString(),
        chunkIndex: c.chunkIndex,
        content: c.content,
        score: 1,
        title: titleMap.get(c.materialId.toString()),
      }));
    }

    const results: RetrievedChunk[] = [];
    for (const material of materials) {
      const doc = await Material.findById(material._id).select("+rawText summary title");
      const text = doc?.rawText ?? doc?.summary;
      if (text) {
        results.push({
          materialId: material._id.toString(),
          chunkIndex: 0,
          content: text.slice(0, 2000),
          score: 1,
          title: doc?.title,
        });
      }
      if (results.length >= limit) break;
    }

    return results;
  }
}
