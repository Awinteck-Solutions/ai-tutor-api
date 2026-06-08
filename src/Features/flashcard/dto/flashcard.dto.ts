import { Difficulty } from "../../../shared/enums/difficulty.enum";
import { IFlashcard } from "../models/flashcard.model";

export interface FlashcardResponse {
  id: string;
  organizationId: string;
  lessonId: string;
  question: string;
  answer: string;
  difficulty: Difficulty;
  order: number;
  createdAt: Date;
}

export function toFlashcardResponse(card: IFlashcard): FlashcardResponse {
  return {
    id: card._id.toString(),
    organizationId: card.organizationId.toString(),
    lessonId: card.lessonId.toString(),
    question: card.question,
    answer: card.answer,
    difficulty: card.difficulty,
    order: card.order,
    createdAt: card.createdAt,
  };
}
