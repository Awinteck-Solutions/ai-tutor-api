import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { ILesson } from "../models/lesson.model";

export interface GenerateLessonInput {
  topicId: string;
  materialIds: string[];
  title?: string;
  order?: number;
}

export interface LessonMaterialRef {
  id: string;
  title: string;
  type: string;
  order: number;
}

export interface LessonResponse {
  id: string;
  organizationId: string;
  topicId: string;
  subjectId: string;
  academicYearId: string;
  createdBy: string;
  isPersonal?: boolean;
  title: string;
  summary?: string;
  objectives: string[];
  concepts: string[];
  examples: string[];
  references: string[];
  content?: string;
  order: number;
  materials: LessonMaterialRef[];
  generationStatus: ProcessingStatus;
  errorMessage?: string;
  jobId?: string;
  flashcardsGenerated: boolean;
  quizGenerated: boolean;
  flashcardCount?: number;
  quizQuestionCount?: number;
  quizGenerationStatus?: ProcessingStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonPlacement {
  topicId: string;
  subjectId: string;
  academicYearId: string;
}

export function toLessonResponse(
  lesson: ILesson,
  materials: LessonMaterialRef[] = [],
  placement?: LessonPlacement,
  enrichment?: {
    flashcardCount?: number;
    quizQuestionCount?: number;
    quizGenerationStatus?: ProcessingStatus | null;
  }
): LessonResponse {
  return {
    id: lesson._id.toString(),
    organizationId: lesson.organizationId.toString(),
    topicId: placement?.topicId ?? lesson.topicId?.toString() ?? "",
    subjectId: placement?.subjectId ?? lesson.subjectId?.toString() ?? "",
    academicYearId:
      placement?.academicYearId ?? lesson.academicYearId?.toString() ?? "",
    createdBy: lesson.createdBy?.toString() ?? "",
    isPersonal: Boolean(lesson.isPersonal),
    title: lesson.title,
    summary: lesson.summary,
    objectives: lesson.objectives,
    concepts: lesson.concepts,
    examples: lesson.examples,
    references: lesson.references,
    content: lesson.content,
    order: lesson.order,
    materials,
    generationStatus: lesson.generationStatus,
    errorMessage: lesson.errorMessage,
    jobId: lesson.jobId,
    flashcardsGenerated: lesson.flashcardsGenerated,
    quizGenerated: lesson.quizGenerated,
    flashcardCount: enrichment?.flashcardCount,
    quizQuestionCount: enrichment?.quizQuestionCount,
    quizGenerationStatus: enrichment?.quizGenerationStatus ?? null,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}
