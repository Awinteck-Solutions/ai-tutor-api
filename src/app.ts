import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
import path from "path";
import http from "http";

import { connectDatabase, disconnectDatabase } from "./database/data-source";
import { Router } from "./routes/all.routes";
import healthRoutes from "./routes/health.routes";
import { startWorkers } from "./workers";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/errorHandler.middleware";
import {
  apiRateLimiter,
  securityMiddleware,
} from "./middlewares/security.middleware";
import { env, validateProductionEnv } from "./config/env";
import { Logger } from "./shared/services/logger";
import { closeQueues } from "./services/queue/job.queue";
import { R2StorageService } from "./services/storage/r2.service";
import { HealthMonitorService } from "./Features/platform/services/healthMonitor.service";

const app = express();

app.set("trust proxy", true);
app.use(...securityMiddleware);
app.use(apiRateLimiter);
app.use(bodyParser.json({ limit: "10mb", strict: false }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "AI Tutor API v1",
    data: { version: "1.0.0", docs: "/swagger" },
  });
});

app.use("/health", healthRoutes);
app.use(Router);

try {
  const swaggerDocument = require(path.join(__dirname, "swagger-output.json"));
  app.use(
    "/swagger",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: "AI Tutor API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );
} catch {
  Logger.warn("Swagger documentation not generated yet");
}

app.use(notFoundHandler);
app.use(errorHandler);

let server: http.Server;

async function bootstrap() {
  validateProductionEnv();
  await connectDatabase();
  await R2StorageService.warmUp();
  startWorkers();
  HealthMonitorService.startScheduler();

  server = app.listen(env.port, () => {
    Logger.info(`Server running on port ${env.port}`, { env: env.nodeEnv });
    const r2 = R2StorageService.configSummary();
    if (!r2.configured) {
      Logger.warn("R2 storage not configured", { hint: r2.hint });
    } else {
      Logger.info("R2 storage configured", {
        bucket: r2.bucketName,
        authMode: r2.mode,
      });
    }
  });

  const shutdown = async (signal: string) => {
    Logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await closeQueues();
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  bootstrap().catch((error) => {
    Logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "unknown",
    });
    process.exit(1);
  });
}

export default app;
