import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { parseAIJson } from "../../shared/utils/parseAIJson";
import { UsageLimitService } from "../../shared/services/usageLimit.service";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIUsageContext {
  organizationId: string;
  userId?: string;
  operation: string;
  tokensUsed?: number;
}

export class AIService {
  private static openai = env.ai.openaiApiKey
    ? new OpenAI({ apiKey: env.ai.openaiApiKey })
    : null;

  private static gemini = env.ai.geminiApiKey
    ? new GoogleGenerativeAI(env.ai.geminiApiKey)
    : null;

  static async chat(
    messages: ChatMessage[],
    usage?: AIUsageContext
  ): Promise<string> {
    if (usage) {
      await UsageLimitService.assertWithinLimits(usage.organizationId);
    }

    const content =
      env.ai.provider === "gemini"
        ? await this.chatGemini(messages)
        : await this.chatOpenAI(messages);

    if (usage) {
      const estimatedTokens =
        usage.tokensUsed ??
        Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
      await UsageLimitService.recordUsage({
        organizationId: usage.organizationId,
        userId: usage.userId,
        operation: usage.operation,
        tokensUsed: estimatedTokens,
      });
    }

    return content;
  }

  static async generateEmbedding(
    text: string,
    usage?: AIUsageContext
  ): Promise<number[]> {
    const [embedding] = await this.generateEmbeddings([text], usage);
    return embedding;
  }

  static async generateEmbeddings(
    texts: string[],
    usage?: AIUsageContext
  ): Promise<number[][]> {
    if (usage) {
      await UsageLimitService.assertWithinLimits(usage.organizationId);
    }

    if (!this.openai) {
      throw new AppError("OpenAI API key not configured for embeddings", 503);
    }

    const response = await this.openai.embeddings.create({
      model: env.ai.embeddingModel,
      input: texts,
    });

    if (usage) {
      const tokens =
        response.usage?.total_tokens ??
        Math.ceil(texts.join("").length / 4);
      await UsageLimitService.recordUsage({
        organizationId: usage.organizationId,
        userId: usage.userId,
        operation: usage.operation,
        tokensUsed: tokens,
      });
    }

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  static async generateJSON<T>(
    prompt: string,
    usage?: AIUsageContext
  ): Promise<T> {
    const systemContent =
      "Respond with valid JSON only. No markdown fences, no code blocks, no Python or other programming languages — output raw JSON.";

    try {
      const content =
        env.ai.provider === "gemini"
          ? await this.chatGeminiJson(systemContent, prompt, usage)
          : await this.chat(
              [
                { role: "system", content: systemContent },
                { role: "user", content: prompt },
              ],
              usage
            );
      return parseAIJson<T>(content);
    } catch (firstError) {
      const content = await this.chat(
        [
          {
            role: "system",
            content:
              "You must output ONLY a single valid JSON value. No explanation, no markdown, no code.",
          },
          { role: "user", content: `${prompt}\n\nOutput JSON only.` },
        ],
        usage
      );
      try {
        return parseAIJson<T>(content);
      } catch {
        throw firstError instanceof Error ? firstError : new Error(String(firstError));
      }
    }
  }

  private static async chatOpenAI(messages: ChatMessage[]): Promise<string> {
    if (!this.openai) {
      throw new AppError("OpenAI API key not configured", 503);
    }

    const response = await this.openai.chat.completions.create({
      model: env.ai.openaiModel,
      messages,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  private static async chatGemini(messages: ChatMessage[]): Promise<string> {
    if (!this.gemini) {
      throw new AppError("Gemini API key not configured", 503);
    }

    const model = this.gemini.getGenerativeModel({ model: env.ai.geminiModel });
    const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const prompt = systemMsg
      ? `${systemMsg}\n\n${userMsgs.map((m) => m.content).join("\n")}`
      : userMsgs.map((m) => m.content).join("\n");

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private static async chatGeminiJson(
    systemContent: string,
    userPrompt: string,
    usage?: AIUsageContext
  ): Promise<string> {
    if (!this.gemini) {
      throw new AppError("Gemini API key not configured", 503);
    }

    if (usage) {
      await UsageLimitService.assertWithinLimits(usage.organizationId);
    }

    const model = this.gemini.getGenerativeModel({
      model: env.ai.geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(
      `${systemContent}\n\n${userPrompt}`
    );
    const text = result.response.text();

    if (usage) {
      const estimatedTokens = Math.ceil((systemContent.length + userPrompt.length) / 4);
      await UsageLimitService.recordUsage({
        organizationId: usage.organizationId,
        userId: usage.userId,
        operation: usage.operation,
        tokensUsed: estimatedTokens,
      });
    }

    return text;
  }
}
