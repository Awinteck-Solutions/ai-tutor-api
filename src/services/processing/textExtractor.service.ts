import Material from "../../Features/material/models/material.model";
import { MaterialType } from "../../shared/enums/materialType.enum";
import { AppError } from "../../shared/errors/AppError";
import { IMaterial } from "../../Features/material/models/material.model";
import { PdfParserService } from "./pdf.parser";
import { R2StorageService } from "../storage/r2.service";
import { YoutubeParserService } from "./youtube.parser";

export class TextExtractorService {
  static async extract(material: IMaterial): Promise<string> {
    switch (material.type) {
      case MaterialType.TEXT:
        return this.extractText(material._id.toString());
      case MaterialType.PDF:
        return this.extractPdf(material);
      case MaterialType.YOUTUBE:
        return this.extractYoutube(material);
      default:
        throw new AppError(`Unsupported material type: ${material.type}`, 400);
    }
  }

  private static async extractText(materialId: string): Promise<string> {
    const doc = await Material.findById(materialId).select("+rawText");
    const text = doc?.rawText?.trim();
    if (!text) {
      throw new AppError("Text content not found", 422);
    }
    return text;
  }

  private static async extractPdf(material: IMaterial): Promise<string> {
    if (!material.r2Key) {
      throw new AppError("PDF file reference not found", 422);
    }

    const buffer = await R2StorageService.download(material.r2Key);
    const text = await PdfParserService.extractText(buffer);

    if (!text) {
      throw new AppError("Could not extract text from PDF", 422);
    }

    return text;
  }

  private static async extractYoutube(material: IMaterial): Promise<string> {
    if (!material.sourceUrl) {
      throw new AppError("YouTube URL not found", 422);
    }
    return YoutubeParserService.extractTranscript(material.sourceUrl);
  }
}
