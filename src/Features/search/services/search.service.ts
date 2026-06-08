import { Status } from "../../../shared/enums/status.enum";
import { AppError } from "../../../shared/errors/AppError";
import {
  buildPaginationMeta,
  parsePagination,
} from "../../../shared/utils/pagination";
import Material from "../../material/models/material.model";
import Lesson from "../../lesson/models/lesson.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import Quiz from "../../quiz/models/quiz.model";
import Topic from "../../academic/models/topic.model";
import Subject from "../../academic/models/subject.model";
import { JwtPayload } from "../../../types/express.d";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";

interface SearchQuery {
  organizationId: string;
  q: string;
  types?: string[];
  page?: number;
  limit?: number;
  user?: JwtPayload;
}

export class SearchService {
  static async search(query: SearchQuery) {
    const { page, limit, skip } = parsePagination(query);
    const regex = { $regex: query.q, $options: "i" };
    const types = query.types ?? ["lessons", "materials", "flashcards", "quizzes", "topics", "subjects"];
    const orgFilter: Record<string, unknown> = {
      organizationId: query.organizationId,
      status: Status.ACTIVE,
    };

    if (query.user) {
      const subjectScope = await EnrollmentScopeService.resolveSubjectScope(
        query.user,
        query.organizationId
      );
      if (subjectScope !== null) {
        EnrollmentScopeService.applySubjectFilter(orgFilter, subjectScope);
      }
    }

    const results: Record<string, unknown[]> = {};

    const tasks: Promise<void>[] = [];

    if (types.includes("materials")) {
      tasks.push(
        Material.find({ ...orgFilter, $or: [{ title: regex }, { subjectName: regex }] })
          .select("title type processingStatus subjectName createdAt")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.materials = items; })
      );
    }
    if (types.includes("lessons")) {
      tasks.push(
        Lesson.find({ ...orgFilter, title: regex })
          .select("title materialId generationStatus createdAt")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.lessons = items; })
      );
    }
    if (types.includes("flashcards")) {
      tasks.push(
        Flashcard.find({ ...orgFilter, $or: [{ question: regex }, { answer: regex }] })
          .select("question answer lessonId createdAt")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.flashcards = items; })
      );
    }
    if (types.includes("quizzes")) {
      tasks.push(
        Quiz.find({ ...orgFilter, title: regex })
          .select("title lessonId generationStatus createdAt")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.quizzes = items; })
      );
    }
    if (types.includes("topics")) {
      tasks.push(
        Topic.find({ ...orgFilter, name: regex })
          .select("name subjectId order")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.topics = items; })
      );
    }
    if (types.includes("subjects")) {
      tasks.push(
        Subject.find({ ...orgFilter, name: regex })
          .select("name code academicYearId")
          .skip(skip)
          .limit(limit)
          .then((items) => { results.subjects = items; })
      );
    }

    await Promise.all(tasks);

    const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    if (!query.q || query.q.length < 2) {
      throw new AppError("Search query must be at least 2 characters", 400);
    }

    return {
      query: query.q,
      results,
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
