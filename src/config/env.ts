import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? "http://localhost:5173",
  dbUrl: requireEnv("DB_URL", "mongodb://localhost:27017/ai-tutor"),
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET", "dev-access-secret-change-in-production"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET", "dev-refresh-secret-change-in-production"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "noreply@ai-tutor.com",
  },
  r2: {
    accountId: (process.env.R2_ACCOUNT_ID ?? "").trim(),
    /** Access Key ID from R2 → Manage API Tokens (optional if R2_API_TOKEN is cfat_/cfut_) */
    accessKeyId: (process.env.R2_ACCESS_KEY_ID ?? "").trim(),
    /** Legacy S3 secret only — do not put cfat_ token here */
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY ?? "").trim(),
    /** Optional — Profile API token id (advanced S3-compatible auth only) */
    apiTokenId: (process.env.R2_API_TOKEN_ID ?? "").trim(),
    /** Cloudflare API token value — Bearer auth with R2_ACCOUNT_ID (most common) */
    apiToken: (process.env.R2_API_TOKEN ?? "").trim(),
    bucketName: (process.env.R2_BUCKET_NAME ?? "adesia").trim(),
    publicUrl: (process.env.R2_PUBLIC_URL ?? "").trim().replace(/\/$/, ""),
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? "openai") as "openai" | "gemini",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: parseInt(
      process.env.EMBEDDING_DIMENSIONS ?? "1536",
      10
    ),
  },
  workers: {
    enabled: process.env.ENABLE_WORKERS !== "false",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
  },
};

export function validateProductionEnv(): void {
  if (env.nodeEnv !== "production") return;

  const required = [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DB_URL",
  ] as const;

  for (const key of required) {
    const val = process.env[key];
    if (!val || val.includes("dev-") || val.includes("change-in-production")) {
      throw new Error(`Production requires secure value for ${key}`);
    }
  }
}
