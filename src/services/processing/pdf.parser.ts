import pdf from "pdf-parse";

export class PdfParserService {
  static async extractText(buffer: Buffer): Promise<string> {
    const data = await pdf(buffer);
    return data.text.trim();
  }
}
