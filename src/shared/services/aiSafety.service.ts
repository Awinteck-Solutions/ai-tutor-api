import { AppError } from "../errors/AppError";

const JAILBREAK_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /you are now (dan|unrestricted|jailbroken)/i,
  /pretend you (have|are) no (rules|restrictions|guidelines)/i,
  /bypass (your )?(safety|content|moderation)/i,
  /system prompt/i,
  /reveal (your )?(instructions|prompt)/i,
];

const HARMFUL_PATTERNS = [
  /\b(hack|exploit|weapon|bomb|kill|suicide)\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(write (me )?a (poem|story|song|joke))\b/i,
  /\b(political|religion|dating|investment advice)\b/i,
];

export class AISafetyService {
  static validateUserPrompt(prompt: string): void {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new AppError("Message cannot be empty", 400);
    }
    if (trimmed.length > 4000) {
      throw new AppError("Message exceeds maximum length", 400);
    }

    for (const pattern of JAILBREAK_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new AppError(
          "Your message was blocked for safety reasons. Please ask educational questions only.",
          400
        );
      }
    }

    for (const pattern of HARMFUL_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new AppError(
          "This request cannot be processed. Please ask educational questions related to your study materials.",
          400
        );
      }
    }
  }

  static buildEducationalSystemPrompt(contextBlock: string): string {
    return `You are an AI tutor for an educational platform. Follow these rules strictly:
1. Answer ONLY using the provided study context and general educational knowledge appropriate to the topic.
2. If the context does not contain enough information, say "I don't have enough information in the uploaded materials to answer that accurately."
3. Never fabricate citations, page numbers, or facts not supported by context.
4. Refuse harmful, illegal, or non-educational requests politely.
5. Keep responses clear, age-appropriate, and focused on learning.
6. When referencing material, mention the source title if available.

STUDY CONTEXT:
${contextBlock || "No specific context available."}`;
  }

  static shouldRefuseOffTopic(prompt: string): boolean {
    return OFF_TOPIC_PATTERNS.some((p) => p.test(prompt));
  }
}
