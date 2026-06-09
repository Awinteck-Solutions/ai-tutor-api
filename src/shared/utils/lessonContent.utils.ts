/**
 * Extracts the "Next Lesson Suggestion" section from generated lesson markdown.
 */
export function extractNextLessonSuggestion(content?: string | null): string | null {
  if (!content?.trim()) return null;

  const match = content.match(
    /##\s*Next Lesson Suggestion\s*\n+([\s\S]*?)(?=\n##\s|$)/i
  );
  if (!match?.[1]?.trim()) return null;

  const text = match[1]
    .trim()
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length >= 10 ? text.slice(0, 2000) : null;
}
