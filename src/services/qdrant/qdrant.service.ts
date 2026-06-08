import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { QDRANT_COLLECTION } from "./qdrant.constants";

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export class QdrantService {
  private static client = new QdrantClient({
    url: env.qdrant.url,
    apiKey: env.qdrant.apiKey || undefined,
  });

  static async ensureCollection(
    collectionName: string,
    vectorSize: number
  ): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === collectionName
    );

    if (!exists) {
      await this.client.createCollection(collectionName, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
    }
  }

  static async upsertPoints(
    collectionName: string,
    points: VectorPoint[]
  ): Promise<void> {
    if (points.length === 0) return;

    await this.client.upsert(collectionName, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  static async search(
    collectionName: string,
    vector: number[],
    limit = 5,
    filter?: Record<string, unknown>
  ): Promise<VectorSearchResult[]> {
    const results = await this.client.search(collectionName, {
      vector,
      limit,
      filter,
      with_payload: true,
    });

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }));
  }

  static async searchByMaterial(
    materialId: string,
    vector: number[],
    limit = 5
  ): Promise<VectorSearchResult[]> {
    return this.search(QDRANT_COLLECTION, vector, limit, {
      must: [{ key: "materialId", match: { value: materialId } }],
    });
  }

  static async searchByOrganization(
    organizationId: string,
    vector: number[],
    limit = 10
  ): Promise<VectorSearchResult[]> {
    return this.search(QDRANT_COLLECTION, vector, limit, {
      must: [{ key: "organizationId", match: { value: organizationId } }],
    });
  }

  static async deleteMaterialVectors(materialId: string): Promise<void> {
    try {
      await this.client.delete(QDRANT_COLLECTION, {
        wait: true,
        filter: {
          must: [{ key: "materialId", match: { value: materialId } }],
        },
      });
    } catch (error) {
      // Collection may not exist yet on first upload
      console.warn(`Qdrant delete for material ${materialId}:`, error);
    }
  }

  static async deleteByFilter(
    collectionName: string,
    filter: Record<string, unknown>
  ): Promise<void> {
    await this.client.delete(collectionName, {
      wait: true,
      filter,
    });
  }

  static assertConfigured(): void {
    if (!env.qdrant.url) {
      throw new AppError("Qdrant is not configured", 503);
    }
  }
}
