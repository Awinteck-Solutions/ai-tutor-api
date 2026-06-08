import mongoose from "mongoose";
import Quiz from "../Features/quiz/models/quiz.model";

/**
 * Removes legacy unique index on quizzes.lessonId (one quiz per lesson).
 * Multiple quiz sets per lesson are supported after this migration.
 */
export async function ensureQuizIndexes(): Promise<void> {
  const collection = mongoose.connection.collection("quizzes");

  try {
    const indexes = await collection.indexes();
    for (const idx of indexes) {
      const keys = idx.key as Record<string, number> | undefined;
      if (!keys || Object.keys(keys).length !== 1 || keys.lessonId !== 1) {
        continue;
      }
      if (!idx.unique) continue;

      const name = idx.name ?? "lessonId_1";
      await collection.dropIndex(name);
      console.log(`[DB] Dropped unique quiz index: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("index not found")) {
      console.warn("[DB] Quiz index migration:", message);
    }
  }

  await Quiz.syncIndexes();
}
