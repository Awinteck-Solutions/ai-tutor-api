export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export function normalizeDifficulty(value: string): Difficulty {
  const upper = value.toUpperCase();
  if (upper === Difficulty.EASY || upper === "EASY") return Difficulty.EASY;
  if (upper === Difficulty.HARD || upper === "HARD") return Difficulty.HARD;
  return Difficulty.MEDIUM;
}
