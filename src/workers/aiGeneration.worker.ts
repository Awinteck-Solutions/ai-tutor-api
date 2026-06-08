import {
  FlashcardGenerationService,
  LessonGenerationService,
  QuizGenerationService,
} from "../Features/lesson/services/lessonGeneration.service";
import {
  createWorker,
  GenerateFlashcardsJobData,
  GenerateLessonJobData,
  GenerateQuizJobData,
  JobType,
} from "../services/queue/job.queue";
import { AI_GENERATION_QUEUE } from "../services/qdrant/qdrant.constants";

export function startAIGenerationWorker(): void {
  createWorker<
    GenerateLessonJobData | GenerateFlashcardsJobData | GenerateQuizJobData
  >(AI_GENERATION_QUEUE, async (job) => {
    switch (job.name) {
      case JobType.GENERATE_LESSON: {
        const data = job.data as GenerateLessonJobData;
        await LessonGenerationService.generate(data.lessonId, data.materialIds);
        break;
      }
      case JobType.GENERATE_FLASHCARDS: {
        const data = job.data as GenerateFlashcardsJobData;
        await FlashcardGenerationService.generate(
          data.flashcardSetId,
          data.lessonId,
          {
            count: data.count,
            difficulty: data.difficulty,
          }
        );
        break;
      }
      case JobType.GENERATE_QUIZ: {
        const data = job.data as GenerateQuizJobData;
        await QuizGenerationService.generate(data.quizId, data.lessonId, {
          count: data.count,
          difficulty: data.difficulty,
        });
        break;
      }
      default:
        console.warn(`[Worker] Unknown job type: ${job.name}`);
    }
  });

  console.log(
    `[Worker] AI generation worker started on queue: ${AI_GENERATION_QUEUE}`
  );
}
