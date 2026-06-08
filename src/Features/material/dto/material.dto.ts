import { MaterialType } from "../../../shared/enums/materialType.enum";
import { MaterialProcessingStage } from "../../../shared/enums/materialProcessingStage.enum";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { IMaterial } from "../models/material.model";
import { IMaterialChunk } from "../models/materialChunk.model";

export interface MaterialUploadBase {
  organizationId: string;
  topicId: string;
  title: string;
  description?: string;
  subjectName?: string;
  tags?: string[];
}

export interface UploadPdfInput extends MaterialUploadBase {}

export interface UploadTextInput extends MaterialUploadBase {
  content: string;
}

export interface UploadYoutubeInput extends MaterialUploadBase {
  youtubeUrl: string;
}

export interface MaterialResponse {
  id: string;
  organizationId: string;
  topicId?: string;
  subjectId: string;
  academicYearId: string;
  uploadedBy: string;
  title: string;
  description?: string;
  type: MaterialType;
  processingStatus: ProcessingStatus;
  processingStage: MaterialProcessingStage;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  r2Url?: string;
  sourceUrl?: string;
  summary?: string;
  chunkCount: number;
  errorMessage?: string;
  jobId?: string;
  tags: string[];
  subjectName?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialChunkResponse {
  id: string;
  chunkIndex: number;
  content: string;
  startChar: number;
  endChar: number;
}

export function toMaterialResponse(material: IMaterial): MaterialResponse {
  return {
    id: material._id.toString(),
    organizationId: material.organizationId.toString(),
    topicId: material.topicId.toString(),
    subjectId: material.subjectId.toString(),
    academicYearId: material.academicYearId.toString(),
    uploadedBy: material.uploadedBy.toString(),
    title: material.title,
    description: material.description,
    type: material.type,
    processingStatus: material.processingStatus,
    processingStage: material.processingStage,
    fileName: material.fileName,
    mimeType: material.mimeType,
    fileSize: material.fileSize,
    r2Url: material.r2Url,
    sourceUrl: material.sourceUrl,
    summary: material.summary,
    chunkCount: material.chunkCount,
    errorMessage: material.errorMessage,
    jobId: material.jobId,
    tags: material.tags,
    subjectName: material.subjectName,
    processingStartedAt: material.processingStartedAt,
    processingCompletedAt: material.processingCompletedAt,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export function toChunkResponse(chunk: IMaterialChunk): MaterialChunkResponse {
  return {
    id: chunk._id.toString(),
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    startChar: chunk.startChar,
    endChar: chunk.endChar,
  };
}
