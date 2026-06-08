function tryParse<T>(jsonStr: string): T | null {
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export function parseAIJson<T>(raw: string): T {
  const trimmed = raw.trim();

  const direct = tryParse<T>(trimmed);
  if (direct !== null) return direct;

  const fencedBlocks = [...trimmed.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedBlocks) {
    const inner = match[1]?.trim();
    if (!inner) continue;
    const parsed = tryParse<T>(inner);
    if (parsed !== null) return parsed;
  }

  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    const parsed = tryParse<T>(trimmed.slice(objStart, objEnd + 1));
    if (parsed !== null) return parsed;
  }

  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    const parsed = tryParse<T>(trimmed.slice(arrStart, arrEnd + 1));
    if (parsed !== null) return parsed;
  }

  throw new SyntaxError(
    `AI response is not valid JSON: ${trimmed.slice(0, 120).replace(/\s+/g, " ")}`
  );
}
