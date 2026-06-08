import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { JwtPayload } from "../../../types/express.d";
import Lesson from "../../lesson/models/lesson.model";
import {
  FlashcardResponse,
  toFlashcardResponse,
} from "../dto/flashcard.dto";
import Flashcard from "../models/flashcard.model";

export class FlashcardService {
  static async listByLesson(
    user: JwtPayload,
    lessonId: string
  ): Promise<FlashcardResponse[]> {
    const lesson = await Lesson.findOne({
      _id: lessonId,
      status: { $ne: Status.DELETED },
    });

    if (!lesson) {
      throw new AppError("Lesson not found", 404);
    }

    await OrganizationAccessService.assertReadAccess(
      user,
      lesson.organizationId.toString()
    );

    const cards = await Flashcard.find({
      lessonId,
      status: Status.ACTIVE,
    }).sort({ order: 1 });

    return cards.map(toFlashcardResponse);
  }
}
