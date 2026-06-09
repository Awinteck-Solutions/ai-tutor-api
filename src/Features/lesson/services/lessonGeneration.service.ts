import { PROMPTS } from "../../../services/ai/prompt.templates";
import { warnIfLessonStructureThin } from "../../../services/ai/lessonPrompt.shared";
import { AIService } from "../../../services/ai/ai.service";
import {
  enqueueJob,
  GenerateFlashcardsJobData,
  GenerateLessonJobData,
  GenerateQuizJobData,
  JobType,
} from "../../../services/queue/job.queue";
import { AI_GENERATION_QUEUE } from "../../../services/qdrant/qdrant.constants";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import {
  getMaterialsContentForAI,
  getLessonMaterialIds,
  buildLessonContext,
} from "../../../shared/services/content.service";
import { AppError } from "../../../shared/errors/AppError";
import Flashcard from "../../flashcard/models/flashcard.model";
import FlashcardSet from "../../flashcard/models/flashcardSet.model";
import Quiz from "../../quiz/models/quiz.model";
import QuizQuestion from "../../quiz/models/quizQuestion.model";
import Lesson from "../models/lesson.model";
import { getAIUserMessage } from "../../../shared/utils/aiErrorMapper";
import { normalizeDifficulty } from "../../../shared/enums/difficulty.enum";
import { normalizeQuizType } from "../../../shared/enums/quizQuestionType.enum";

interface GeneratedLesson {
  title: string;
  summary: string;
  objectives: string[];
  concepts: string[];
  examples: string[];
  references: string[];
  content: string;
}

interface GeneratedFlashcard {
  question: string;
  answer: string;
  difficulty: string;
}

interface GeneratedQuizQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
}

export async function enqueueLessonPracticeAssets(
  lessonId: string,
  title: string
): Promise<void> {
  await LessonGenerationService.enqueuePracticeAssets(lessonId, title);
}

export class LessonGenerationService {
  static async generate(
    lessonId: string,
    explicitMaterialIds?: string[]
  ): Promise<void> {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    lesson.generationStatus = ProcessingStatus.PROCESSING;
    lesson.errorMessage = undefined;
    await lesson.save();

    try {
      const materialIds =
        explicitMaterialIds?.length && explicitMaterialIds.length > 0
          ? explicitMaterialIds
          : await getLessonMaterialIds(lessonId);
      if (materialIds.length === 0) {
        throw new AppError("Lesson has no source materials", 422);
      }

      const content = await getMaterialsContentForAI(materialIds);
      const generated = await AIService.generateJSON<GeneratedLesson>(
        PROMPTS.lessonGeneration(content, {
          titleHint: lesson.title,
          studentLevel: lesson.studentLevel,
        }),
        {
          organizationId: lesson.organizationId.toString(),
          operation: "lesson_generation",
        },
        { maxTokens: 8192 }
      );

      warnIfLessonStructureThin(generated);

      lesson.title = generated.title || lesson.title;
      lesson.summary = generated.summary;
      lesson.objectives = generated.objectives ?? [];
      lesson.concepts = generated.concepts ?? [];
      lesson.examples = generated.examples ?? [];
      lesson.references = generated.references ?? [];
      lesson.content = generated.content;
      lesson.generationStatus = ProcessingStatus.COMPLETED;
      await lesson.save();

      console.log(`[AI] Lesson ${lessonId} generated successfully`);

      await enqueueLessonPracticeAssets(lessonId, lesson.title);
    } catch (error) {
      const message = getAIUserMessage(error);

      lesson.generationStatus = ProcessingStatus.FAILED;
      lesson.errorMessage = message;
      await lesson.save();

      console.error(`[AI] Lesson ${lessonId} failed:`, error);
      throw error instanceof AppError ? error : new AppError(message, 503);
    }
  }

  static async enqueuePracticeAssets(
    lessonId: string,
    title: string
  ): Promise<void> {
    await Promise.all([
      this.enqueueFlashcards(lessonId, title),
      this.enqueueQuiz(lessonId, title),
    ]);
  }

  private static async enqueueFlashcards(
    lessonId: string,
    title: string
  ): Promise<void> {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return;

    const set = await FlashcardSet.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title: `${title} Flashcards`,
      setLabel: "10 cards · medium",
      difficulty: "medium",
      generationStatus: ProcessingStatus.PENDING,
    });

    const jobId = await enqueueJob<GenerateFlashcardsJobData>(
      AI_GENERATION_QUEUE,
      JobType.GENERATE_FLASHCARDS,
      {
        flashcardSetId: set._id.toString(),
        lessonId,
        count: 10,
        difficulty: "medium",
      }
    );

    set.generationStatus = ProcessingStatus.QUEUED;
    set.jobId = jobId;
    await set.save();

    console.log(`[AI] Flashcard generation queued for lesson ${lessonId} (${jobId})`);
  }

  private static async enqueueQuiz(
    lessonId: string,
    title: string
  ): Promise<void> {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return;

    const quiz = await Quiz.create({
      organizationId: lesson.organizationId,
      lessonId: lesson._id,
      title: `${title} Quiz`,
      generationStatus: ProcessingStatus.PENDING,
    });

    const jobId = await enqueueJob<GenerateQuizJobData>(
      AI_GENERATION_QUEUE,
      JobType.GENERATE_QUIZ,
      { quizId: quiz._id.toString(), lessonId }
    );

    quiz.generationStatus = ProcessingStatus.QUEUED;
    quiz.jobId = jobId;
    await quiz.save();

    console.log(`[AI] Quiz generation queued for lesson ${lessonId} (${jobId})`);
  }
}

export interface FlashcardGenerationOptions {
  count?: number;
  difficulty?: string;
}

export interface QuizGenerationOptions {
  count?: number;
  difficulty?: string;
}

export class FlashcardGenerationService {
  static async generate(
    flashcardSetId: string,
    lessonId: string,
    options: FlashcardGenerationOptions = {}
  ): Promise<void> {
    const [set, lesson] = await Promise.all([
      FlashcardSet.findById(flashcardSetId),
      Lesson.findById(lessonId),
    ]);

    if (!set || !lesson) {
      throw new Error("Flashcard set or lesson not found");
    }

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new Error("Lesson must be completed before generating flashcards");
    }

    const count = Math.min(30, Math.max(3, options.count ?? 10));
    const difficulty = options.difficulty ?? set.difficulty ?? "medium";

    set.generationStatus = ProcessingStatus.PROCESSING;
    set.errorMessage = undefined;
    await set.save();

    try {
      const context = buildLessonContext(lesson);

      const generated = await AIService.generateJSON<GeneratedFlashcard[]>(
        PROMPTS.flashcardGeneration(context, count, difficulty)
      );

      await Flashcard.deleteMany({ flashcardSetId: set._id });

      const cards = (Array.isArray(generated) ? generated : []).map(
        (card, index) => ({
          organizationId: lesson.organizationId,
          lessonId: lesson._id,
          flashcardSetId: set._id,
          question: card.question,
          answer: card.answer,
          difficulty: normalizeDifficulty(card.difficulty ?? difficulty),
          order: index,
        })
      );

      if (cards.length > 0) {
        await Flashcard.insertMany(cards);
      }

      set.cardCount = cards.length;
      set.difficulty = difficulty;
      set.generationStatus = ProcessingStatus.COMPLETED;
      await set.save();

      lesson.flashcardsGenerated = cards.length > 0;
      await lesson.save();

      console.log(
        `[AI] Generated ${cards.length} flashcards for set ${flashcardSetId} (lesson ${lessonId})`
      );
    } catch (error) {
      const message = getAIUserMessage(error);

      set.generationStatus = ProcessingStatus.FAILED;
      set.errorMessage = message;
      await set.save();

      console.error(
        `[AI] Flashcard generation failed for set ${flashcardSetId}:`,
        error
      );
      throw error instanceof AppError ? error : new AppError(message, 503);
    }
  }
}

export class QuizGenerationService {
  static async generate(
    quizId: string,
    lessonId: string,
    options: QuizGenerationOptions = {}
  ): Promise<void> {
    const [quiz, lesson] = await Promise.all([
      Quiz.findById(quizId),
      Lesson.findById(lessonId),
    ]);

    if (!quiz || !lesson) {
      throw new Error("Quiz or lesson not found");
    }

    if (lesson.generationStatus !== ProcessingStatus.COMPLETED) {
      throw new Error("Lesson must be completed before generating quiz");
    }

    quiz.generationStatus = ProcessingStatus.PROCESSING;
    quiz.errorMessage = undefined;
    await quiz.save();

    try {
      const context = buildLessonContext(lesson);

      const count = Math.min(25, Math.max(3, options.count ?? 10));
      const difficulty = options.difficulty ?? "medium";

      const generated = await AIService.generateJSON<GeneratedQuizQuestion[]>(
        PROMPTS.quizGeneration(context, count, difficulty)
      );

      await QuizQuestion.deleteMany({ quizId: quiz._id });

      const questions = (Array.isArray(generated) ? generated : []).map(
        (q, index) => ({
          quizId: quiz._id,
          lessonId: lesson._id,
          type: normalizeQuizType(q.type),
          question: q.question,
          options: q.options ?? (q.type === "true_false" ? ["True", "False"] : []),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? "",
          difficulty: normalizeDifficulty(q.difficulty ?? difficulty),
          order: index,
        })
      );

      if (questions.length > 0) {
        await QuizQuestion.insertMany(questions);
      }

      quiz.questionCount = questions.length;
      quiz.difficulty = difficulty;
      quiz.generationStatus = ProcessingStatus.COMPLETED;
      await quiz.save();

      lesson.quizGenerated = questions.length > 0;
      await lesson.save();

      console.log(
        `[AI] Generated ${questions.length} quiz questions for lesson ${lessonId}`
      );
    } catch (error) {
      const message = getAIUserMessage(error);

      quiz.generationStatus = ProcessingStatus.FAILED;
      quiz.errorMessage = message;
      await quiz.save();

      console.error(`[AI] Quiz generation failed for ${lessonId}:`, error);
      throw error instanceof AppError ? error : new AppError(message, 503);
    }
  }
}

export async function enqueueLessonGeneration(
  lessonId: string,
  materialIds?: string[]
): Promise<string> {
  return enqueueJob<GenerateLessonJobData>(
    AI_GENERATION_QUEUE,
    JobType.GENERATE_LESSON,
    { lessonId, materialIds }
  );
}
