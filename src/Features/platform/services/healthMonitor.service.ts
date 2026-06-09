import mongoose from "mongoose";
import Redis from "ioredis";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../../config/env";
import ServiceHealthCheck from "../models/serviceHealthCheck.model";
import {
  ServiceComponent,
  ServiceHealthStatus,
} from "../../../shared/enums/serviceComponent.enum";
import { Logger } from "../../../shared/services/logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let schedulerStarted = false;

export class HealthMonitorService {
  static startScheduler(): void {
    if (schedulerStarted || env.nodeEnv === "test") return;
    schedulerStarted = true;

    void this.runChecks();
    setInterval(() => {
      void this.runChecks();
    }, CHECK_INTERVAL_MS).unref();
  }

  static async runChecks(): Promise<void> {
    const apiCheck = {
      component: ServiceComponent.API,
      status: ServiceHealthStatus.UP,
      latencyMs: 0,
      message: "API process running",
    };

    const results = await Promise.all([
      Promise.resolve(apiCheck),
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQdrant(),
      this.checkAiProvider(),
    ]);

    await ServiceHealthCheck.insertMany(results);
    await ServiceHealthCheck.deleteMany({
      createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    Logger.debug("Health checks recorded", {
      components: results.map((r) => `${r.component}:${r.status}`).join(", "),
    });
  }

  static async getOverview(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const components = Object.values(ServiceComponent);

    const latest = await Promise.all(
      components.map(async (component) => {
        const check = await ServiceHealthCheck.findOne({ component })
          .sort({ createdAt: -1 })
          .lean();
        return check
          ? {
              component,
              status: check.status,
              latencyMs: check.latencyMs,
              message: check.message,
              checkedAt: check.createdAt,
              metadata: check.metadata,
            }
          : {
              component,
              status: ServiceHealthStatus.DOWN,
              message: "No checks recorded yet",
              checkedAt: null,
            };
      })
    );

    const history = await ServiceHealthCheck.find({
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const uptimeByComponent = await Promise.all(
      components.map(async (component) => {
        const checks = await ServiceHealthCheck.find({
          component,
          createdAt: { $gte: since },
        }).lean();
        if (checks.length === 0) {
          return { component, uptimePercent: 0, samples: 0 };
        }
        const upCount = checks.filter(
          (c) => c.status === ServiceHealthStatus.UP
        ).length;
        return {
          component,
          uptimePercent: Math.round((upCount / checks.length) * 1000) / 10,
          samples: checks.length,
        };
      })
    );

    const apiUptime = uptimeByComponent.find(
      (u) => u.component === ServiceComponent.API
    );
    const overallUp = latest.filter(
      (l) => l.status === ServiceHealthStatus.UP
    ).length;
    const overallStatus =
      overallUp === latest.length
        ? ServiceHealthStatus.UP
        : overallUp === 0
          ? ServiceHealthStatus.DOWN
          : ServiceHealthStatus.DEGRADED;

    return {
      overallStatus,
      processUptimeSeconds: Math.floor(process.uptime()),
      latest,
      uptimeByComponent,
      apiUptimePercent: apiUptime?.uptimePercent ?? 100,
      history: history.map((h) => ({
        id: h._id.toString(),
        component: h.component,
        status: h.status,
        latencyMs: h.latencyMs,
        message: h.message,
        createdAt: h.createdAt,
      })),
    };
  }

  private static async checkDatabase() {
    const start = Date.now();
    try {
      const ready = mongoose.connection.readyState === 1;
      return {
        component: ServiceComponent.DATABASE,
        status: ready ? ServiceHealthStatus.UP : ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: ready ? "Connected" : "Disconnected",
      };
    } catch (error) {
      return {
        component: ServiceComponent.DATABASE,
        status: ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Database check failed",
      };
    }
  }

  private static async checkRedis() {
    const start = Date.now();
    const redis = new Redis(env.redis.url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();
      return {
        component: ServiceComponent.REDIS,
        status:
          pong === "PONG" ? ServiceHealthStatus.UP : ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: pong === "PONG" ? "Pong" : "Unexpected Redis response",
      };
    } catch (error) {
      try {
        await redis.quit();
      } catch {
        /* ignore */
      }
      return {
        component: ServiceComponent.REDIS,
        status: ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Redis unreachable",
      };
    }
  }

  private static async checkQdrant() {
    const start = Date.now();
    try {
      const client = new QdrantClient({
        url: env.qdrant.url,
        apiKey: env.qdrant.apiKey || undefined,
      });
      await client.getCollections();
      return {
        component: ServiceComponent.QDRANT,
        status: ServiceHealthStatus.UP,
        latencyMs: Date.now() - start,
        message: "Collections reachable",
      };
    } catch (error) {
      return {
        component: ServiceComponent.QDRANT,
        status: ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Qdrant unreachable",
      };
    }
  }

  private static async checkAiProvider() {
    const start = Date.now();
    const provider = env.ai.provider;
    const configured =
      provider === "gemini"
        ? Boolean(env.ai.geminiApiKey)
        : provider === "claude"
          ? Boolean(env.ai.anthropicApiKey)
          : Boolean(env.ai.openaiApiKey);
    const embeddingsConfigured = Boolean(env.ai.openaiApiKey);

    if (!configured) {
      return {
        component: ServiceComponent.AI_PROVIDER,
        status: ServiceHealthStatus.DOWN,
        latencyMs: Date.now() - start,
        message: `${provider} API key not configured`,
        metadata: { provider, embeddingsConfigured },
      };
    }

    return {
      component: ServiceComponent.AI_PROVIDER,
      status: embeddingsConfigured
        ? ServiceHealthStatus.UP
        : ServiceHealthStatus.DEGRADED,
      latencyMs: Date.now() - start,
      message: embeddingsConfigured
        ? `${provider} chat + OpenAI embeddings configured`
        : `${provider} configured; OpenAI embeddings missing (RAG chat may fail)`,
      metadata: { provider, embeddingsConfigured },
    };
  }

  static async recordApiHeartbeat() {
    await ServiceHealthCheck.create({
      component: ServiceComponent.API,
      status: ServiceHealthStatus.UP,
      latencyMs: 0,
      message: "API process running",
    });
  }
}
