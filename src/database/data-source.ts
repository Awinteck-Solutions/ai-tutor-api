import mongoose from "mongoose";
import { env } from "../config/env";
import { ensureQuizIndexes } from "./quizIndexes";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.dbUrl, {
      autoIndex: env.nodeEnv !== "production",
    });
    await ensureQuizIndexes();
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
