export enum QuizQuestionType {
  MCQ = "MCQ",
  TRUE_FALSE = "TRUE_FALSE",
  FILL_BLANK = "FILL_BLANK",
}

export function normalizeQuizType(value: string): QuizQuestionType {
  const normalized = value.toLowerCase().replace(/-/g, "_");
  switch (normalized) {
    case "mcq":
    case "multiple_choice":
      return QuizQuestionType.MCQ;
    case "true_false":
    case "boolean":
      return QuizQuestionType.TRUE_FALSE;
    case "fill_blank":
    case "fill_in_blank":
    case "fill_in_the_blank":
      return QuizQuestionType.FILL_BLANK;
    default:
      return QuizQuestionType.MCQ;
  }
}
