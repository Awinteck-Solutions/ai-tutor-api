import { XpSourceType } from "../../../shared/enums/xpSourceType.enum";

export const XP_AMOUNTS: Record<XpSourceType, number> = {
  [XpSourceType.LESSON]: 100,
  [XpSourceType.QUIZ]: 75,
  [XpSourceType.FLASHCARD]: 0,
  [XpSourceType.FLASHCARD_LESSON]: 15,
};
