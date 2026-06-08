import { env } from "../config/env";
import { startMaterialWorker } from "./material.worker";
import { startAIGenerationWorker } from "./aiGeneration.worker";

export function startWorkers(): void {
  if (!env.workers.enabled) {
    console.log("[Worker] Background workers disabled (ENABLE_WORKERS=false)");
    return;
  }

  try {
    startMaterialWorker();
    startAIGenerationWorker();
  } catch (error) {
    console.error(
      "[Worker] Failed to start workers. Ensure Redis is running:",
      error
    );
  }
}
