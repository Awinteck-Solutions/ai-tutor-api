import { AppError } from "../errors/AppError";

export const AI_USER_MESSAGES = {
  HIGH_DEMAND:
    "Our AI service is experiencing high demand right now. Please try again in a few minutes.",
  RATE_LIMIT:
    "You've reached the AI usage limit. Please try again later.",
  TIMEOUT: "The request took too long. Please try again.",
  UNAVAILABLE:
    "Our AI service is temporarily unavailable. Please try again later.",
  FAILED:
    "We couldn't complete this request right now. Please try again later.",
} as const;

const PROVIDER_LEAK_PATTERNS = [
  /GoogleGenerativeAI/i,
  /generativelanguage\.googleapis\.com/i,
  /models\/gemini-/i,
  /\bgemini-[\d.]/i,
  /\bgpt-[\d.o-]/i,
  /\bopenai\b/i,
  /OpenAI API/i,
  /ChatCompletion/i,
  /generateContent/i,
  /v1beta\/models/i,
  /\banthropic\b/i,
  /Anthropic API/i,
  /\bclaude-[\d.a-z-]/i,
  /api\.anthropic\.com/i,
  /API key not configured/i,
];

function rawErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isAIProviderLeak(message: string): boolean {
  return PROVIDER_LEAK_PATTERNS.some((pattern) => pattern.test(message));
}

function classifyRawMessage(raw: string): { message: string; statusCode: number } {
  const lower = raw.toLowerCase();

  if (
    lower.includes("high demand") ||
    lower.includes("experiencing high demand") ||
    lower.includes("overloaded") ||
    lower.includes("capacity") ||
    (lower.includes("503") && lower.includes("service unavailable"))
  ) {
    return { message: AI_USER_MESSAGES.HIGH_DEMAND, statusCode: 503 };
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("429")
  ) {
    return { message: AI_USER_MESSAGES.RATE_LIMIT, statusCode: 429 };
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("deadline exceeded")
  ) {
    return { message: AI_USER_MESSAGES.TIMEOUT, statusCode: 504 };
  }

  if (
    lower.includes("api key not configured") ||
    lower.includes("not configured for embeddings") ||
    lower.includes("not found for api version") ||
    lower.includes("is not found") ||
    lower.includes("404")
  ) {
    return { message: AI_USER_MESSAGES.UNAVAILABLE, statusCode: 503 };
  }

  if (isAIProviderLeak(raw)) {
    return { message: AI_USER_MESSAGES.FAILED, statusCode: 503 };
  }

  return { message: AI_USER_MESSAGES.FAILED, statusCode: 503 };
}

export function getAIUserMessage(error: unknown): string {
  return toAIUserError(error).message;
}

export function toAIUserError(error: unknown): AppError {
  if (error instanceof AppError) {
    if (!isAIProviderLeak(error.message)) {
      return error;
    }
    const classified = classifyRawMessage(error.message);
    return new AppError(classified.message, classified.statusCode, error.details);
  }

  const raw = rawErrorMessage(error);
  const classified = classifyRawMessage(raw);
  console.error("[AI] Provider error:", raw);
  return new AppError(classified.message, classified.statusCode);
}

export function sanitizeErrorMessageForClient(message: string): string {
  if (!message || !isAIProviderLeak(message)) {
    return message;
  }
  return classifyRawMessage(message).message;
}
