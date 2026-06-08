export interface TextChunk {
  index: number;
  content: string;
  startChar: number;
  endChar: number;
}

export class ChunkingService {
  static chunkText(
    text: string,
    chunkSize = 1000,
    overlap = 200
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        index,
        content: text.slice(start, end).trim(),
        startChar: start,
        endChar: end,
      });
      start += chunkSize - overlap;
      index++;
    }

    return chunks.filter((c) => c.content.length > 0);
  }
}
