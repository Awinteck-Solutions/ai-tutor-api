import Material from "../../Features/material/models/material.model";
import MaterialChunk from "../../Features/material/models/materialChunk.model";
import Lesson from "../../Features/lesson/models/lesson.model";
import LessonMaterial from "../../Features/lesson/models/lessonMaterial.model";
import { ProcessingStatus } from "../enums/processingStatus.enum";
import { AppError } from "../errors/AppError";

export async function getMaterialContentForAI(
  materialId: string
): Promise<string> {
  const material = await Material.findById(materialId).select("+rawText title processingStatus");
  if (
    !material ||
    material.processingStatus !== ProcessingStatus.COMPLETED
  ) {
    throw new AppError(
      `Material must be fully processed before AI generation${material ? `: ${material.title}` : ""}`,
      422
    );
  }

  const body = await extractMaterialText(material);
  return `--- Material: ${material.title} ---\n${body}`;
}

export async function getMaterialsContentForAI(
  materialIds: string[]
): Promise<string> {
  if (materialIds.length === 0) {
    throw new AppError("At least one material is required", 400);
  }

  const parts: string[] = [];
  for (const materialId of materialIds) {
    parts.push(await getMaterialContentForAI(materialId));
  }

  return parts.join("\n\n");
}

export async function getLessonMaterialIds(lessonId: string): Promise<string[]> {
  const links = await LessonMaterial.find({ lessonId }).sort({ order: 1 });
  if (links.length > 0) {
    return links.map((l) => l.materialId.toString());
  }

  const lesson = await Lesson.findById(lessonId).select("materialId");
  if (lesson?.materialId) {
    return [lesson.materialId.toString()];
  }

  return [];
}

async function extractMaterialText(material: {
  rawText?: string;
  summary?: string;
  _id: unknown;
}): Promise<string> {
  if (material.rawText?.trim()) {
    return material.rawText.trim();
  }

  if (material.summary?.trim()) {
    return material.summary.trim();
  }

  const chunks = await MaterialChunk.find({ materialId: material._id })
    .sort({ chunkIndex: 1 })
    .limit(50);

  if (chunks.length > 0) {
    return chunks.map((c) => c.content).join("\n\n");
  }

  throw new AppError("No content available for AI generation", 422);
}

export function buildLessonContext(lesson: {
  title: string;
  summary?: string;
  objectives: string[];
  concepts: string[];
  examples: string[];
  content?: string;
}): string {
  return [
    `# ${lesson.title}`,
    lesson.summary ? `Summary: ${lesson.summary}` : "",
    lesson.objectives.length
      ? `Objectives:\n${lesson.objectives.map((o) => `- ${o}`).join("\n")}`
      : "",
    lesson.concepts.length
      ? `Concepts:\n${lesson.concepts.map((c) => `- ${c}`).join("\n")}`
      : "",
    lesson.examples.length
      ? `Examples:\n${lesson.examples.map((e) => `- ${e}`).join("\n")}`
      : "",
    lesson.content ? `Content:\n${lesson.content}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
