import { AIService } from "../ai/ai.service";

export class EmbeddingService {
  static async generate(text: string): Promise<number[]> {
    return AIService.generateEmbedding(text);
  }

  static async generateBatch(texts: string[]): Promise<number[][]> {
    return AIService.generateEmbeddings(texts);
  }
}
