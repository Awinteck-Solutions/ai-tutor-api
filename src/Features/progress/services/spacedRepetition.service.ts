import { FlashcardReviewResult } from "../../../shared/enums/progress.enum";
import FlashcardProgress from "../models/flashcardProgress.model";

/** SM-2 inspired spaced repetition */
export class SpacedRepetitionService {
  static qualityFromResult(result: FlashcardReviewResult): number {
    return result === FlashcardReviewResult.CORRECT ? 5 : 1;
  }

  static async review(
    userId: string,
    organizationId: string,
    flashcardId: string,
    result: FlashcardReviewResult
  ) {
    const quality = this.qualityFromResult(result);
    let progress = await FlashcardProgress.findOne({ userId, flashcardId });

    if (!progress) {
      progress = await FlashcardProgress.create({
        userId,
        organizationId,
        flashcardId,
        nextReviewAt: new Date(),
      });
    }

    if (quality < 3) {
      progress.repetitions = 0;
      progress.intervalDays = 1;
    } else {
      if (progress.repetitions === 0) {
        progress.intervalDays = 1;
      } else if (progress.repetitions === 1) {
        progress.intervalDays = 3;
      } else {
        progress.intervalDays = Math.round(progress.intervalDays * progress.easeFactor);
      }
      progress.repetitions += 1;
    }

    progress.easeFactor = Math.max(
      1.3,
      progress.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    progress.confidenceScore = Math.min(
      100,
      Math.max(0, progress.confidenceScore + (quality >= 3 ? 10 : -15))
    );
    progress.masteryLevel = Math.min(5, Math.floor(progress.repetitions / 2));
    progress.lastReviewedAt = new Date();
    progress.nextReviewAt = new Date(
      Date.now() + progress.intervalDays * 24 * 60 * 60 * 1000
    );

    await progress.save();
    return progress;
  }

  static async getDueCards(userId: string, organizationId: string, limit = 20) {
    return FlashcardProgress.find({
      userId,
      organizationId,
      nextReviewAt: { $lte: new Date() },
    })
      .sort({ nextReviewAt: 1 })
      .limit(limit)
      .populate("flashcardId");
  }
}
