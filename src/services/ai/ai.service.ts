import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import {
  AI_USER_MESSAGES,
  toAIUserError,
} from "../../shared/utils/aiErrorMapper";
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

export interface GenerateJSONOptions {
  maxTokens?: number;
}

type AnthropicMessage = Anthropic.MessageParam;

export class AIService {
  private static openai = env.ai.openaiApiKey
    ? new OpenAI({ apiKey: env.ai.openaiApiKey })
    : null;

  private static gemini = env.ai.geminiApiKey
    ? new GoogleGenerativeAI(env.ai.geminiApiKey)
    : null;

  private static anthropic = env.ai.anthropicApiKey
    ? new Anthropic({ apiKey: env.ai.anthropicApiKey })
    : null;

  private static async invokeAI<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toAIUserError(error);
    }
  }

  static async chat(
    messages: ChatMessage[],
    usage?: AIUsageContext,
    options?: GenerateJSONOptions
  ): Promise<string> {
    if (usage) {
      await UsageLimitService.assertWithinLimits(usage.organizationId);
    }

    const content = await this.invokeAI(() =>
      this.dispatchChat(messages, options)
    );

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
      throw new AppError(AI_USER_MESSAGES.UNAVAILABLE, 503);
    }

    const response = await this.invokeAI(() =>
      this.openai!.embeddings.create({
        model: env.ai.embeddingModel,
        input: texts,
      })
    );

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
    usage?: AIUsageContext,
    options?: GenerateJSONOptions
  ): Promise<T> {
    const systemContent =
      "Respond with valid JSON only. No markdown fences, no code blocks, no Python or other programming languages — output raw JSON.";

    try {
      const content =
        env.ai.provider === "gemini"
          ? await this.invokeAI(() =>
              this.chatGeminiJson(systemContent, prompt, usage, options)
            )
          : await this.chat(
              [
                { role: "system", content: systemContent },
                { role: "user", content: prompt },
              ],
              usage,
              options
            );
      return parseAIJson<T>(content);
    } catch (firstError) {
      try {
        const content = await this.chat(
          [
            {
              role: "system",
              content:
                "You must output ONLY a single valid JSON value. No explanation, no markdown, no code.",
            },
            { role: "user", content: `${prompt}\n\nOutput JSON only.` },
          ],
          usage,
          options
        );
        return parseAIJson<T>(content);
      } catch {
        throw toAIUserError(firstError);
      }
    }
  }

  private static dispatchChat(
    messages: ChatMessage[],
    options?: GenerateJSONOptions
  ): Promise<string> {
    switch (env.ai.provider) {
      case "gemini":
        return this.chatGemini(messages, options);
      case "claude":
        return this.chatClaude(messages, options);
      default:
        return this.chatOpenAI(messages, options);
    }
  }

  private static async chatOpenAI(
    messages: ChatMessage[],
    options?: GenerateJSONOptions
  ): Promise<string> {
    if (!this.openai) {
      throw new AppError(AI_USER_MESSAGES.UNAVAILABLE, 503);
    }

    const response = await this.openai.chat.completions.create({
      model: env.ai.openaiModel,
      messages,
      temperature: 0.3,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    });

    return response.choices[0]?.message?.content ?? "";
  }

  private static async chatGemini(
    messages: ChatMessage[],
    options?: GenerateJSONOptions
  ): Promise<string> {
    if (!this.gemini) {
      throw new AppError(AI_USER_MESSAGES.UNAVAILABLE, 503);
    }

    const model = this.gemini.getGenerativeModel({
      model: env.ai.geminiModel,
      ...(options?.maxTokens
        ? { generationConfig: { maxOutputTokens: options.maxTokens } }
        : {}),
    });
    const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const prompt = systemMsg
      ? `${systemMsg}\n\n${userMsgs.map((m) => m.content).join("\n")}`
      : userMsgs.map((m) => m.content).join("\n");

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private static async chatClaude(
    messages: ChatMessage[],
    options?: GenerateJSONOptions
  ): Promise<string> {
    if (!this.anthropic) {
      throw new AppError(AI_USER_MESSAGES.UNAVAILABLE, 503);
    }

    const { system, anthropicMessages } =
      this.toAnthropicMessages(messages);

    const response = await this.anthropic.messages.create({
      model: env.ai.claudeModel,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: 0.3,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  private static toAnthropicMessages(messages: ChatMessage[]): {
    system: string;
    anthropicMessages: AnthropicMessage[];
  } {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const conversation = messages.filter((m) => m.role !== "system");
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of conversation) {
      const role = message.role === "assistant" ? "assistant" : "user";
      const last = anthropicMessages[anthropicMessages.length - 1];

      if (last && last.role === role) {
        last.content = `${String(last.content)}\n\n${message.content}`;
        continue;
      }

      anthropicMessages.push({ role, content: message.content });
    }

    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: "user", content: "Hello" });
    } else if (anthropicMessages[0].role === "assistant") {
      anthropicMessages.unshift({ role: "user", content: "Continue our conversation." });
    }

    return { system, anthropicMessages };
  }

  private static async chatGeminiJson(
    systemContent: string,
    userPrompt: string,
    usage?: AIUsageContext,
    options?: GenerateJSONOptions
  ): Promise<string> {
    if (!this.gemini) {
      throw new AppError(AI_USER_MESSAGES.UNAVAILABLE, 503);
    }

    if (usage) {
      await UsageLimitService.assertWithinLimits(usage.organizationId);
    }

    const model = this.gemini.getGenerativeModel({
      model: env.ai.geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
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
