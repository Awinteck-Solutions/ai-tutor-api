import mongoose from "mongoose";
import { AppError } from "../../../shared/errors/AppError";
import { OrganizationAccessService } from "../../../shared/services/organizationAccess.service";
import { JwtPayload } from "../../../types/express.d";
import StudentNote from "../models/studentNote.model";
import Lesson from "../../lesson/models/lesson.model";

export class StudentNoteService {
  static async list(
    user: JwtPayload,
    organizationId: string,
    filters: {
      lessonId?: string;
      quizId?: string;
      flashcardId?: string;
      scope?: "all" | "general" | "lesson";
    }
  ) {
    await OrganizationAccessService.assertReadAccess(user, organizationId);

    const query: Record<string, unknown> = {
      userId: user.sub,
      organizationId,
    };
    if (filters.lessonId) query.lessonId = filters.lessonId;
    if (filters.quizId) query.quizId = filters.quizId;
    if (filters.flashcardId) query.flashcardId = filters.flashcardId;

    if (filters.scope === "general") {
      query.$or = [
        { lessonId: { $exists: false } },
        { lessonId: null },
      ];
    } else if (filters.scope === "lesson") {
      query.lessonId = { $exists: true, $ne: null };
    }

    const notes = await StudentNote.find(query).sort({ updatedAt: -1 }).limit(100);

    const lessonIds = [
      ...new Set(
        notes.map((n) => n.lessonId?.toString()).filter(Boolean) as string[]
      ),
    ];
    const lessons = lessonIds.length
      ? await Lesson.find({ _id: { $in: lessonIds } }).select("title")
      : [];
    const lessonTitleMap = new Map(
      lessons.map((l) => [l._id.toString(), l.title])
    );

    return notes.map((n) => {
      const lessonId = n.lessonId?.toString();
      return {
        id: n._id.toString(),
        title: n.title,
        content: n.content,
        lessonId,
        lessonTitle: lessonId ? lessonTitleMap.get(lessonId) ?? "Lesson" : null,
        quizId: n.quizId?.toString(),
        flashcardId: n.flashcardId?.toString(),
        isGeneral: !lessonId && !n.quizId && !n.flashcardId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      };
    });
  }

  static async upsert(
    user: JwtPayload,
    organizationId: string,
    input: {
      id?: string;
      lessonId?: string | null;
      quizId?: string | null;
      flashcardId?: string | null;
      title?: string;
      content: string;
    }
  ) {
    await OrganizationAccessService.assertReadAccess(user, organizationId);

    if (input.id?.trim()) {
      const note = await StudentNote.findOne({
        _id: input.id,
        userId: user.sub,
        organizationId,
      });
      if (!note) throw new AppError("Note not found", 404);
      if (input.title !== undefined) note.title = input.title.trim() || "Untitled note";
      note.content = input.content;
      if (input.lessonId !== undefined) {
        note.lessonId =
          input.lessonId && input.lessonId !== ""
            ? new mongoose.Types.ObjectId(input.lessonId)
            : undefined;
      }
      if (input.quizId !== undefined) {
        note.quizId =
          input.quizId && input.quizId !== ""
            ? new mongoose.Types.ObjectId(input.quizId)
            : undefined;
      }
      if (input.flashcardId !== undefined) {
        note.flashcardId =
          input.flashcardId && input.flashcardId !== ""
            ? new mongoose.Types.ObjectId(input.flashcardId)
            : undefined;
      }
      await note.save();
      return await this.toResponse(note);
    }

    const created = await StudentNote.create({
      userId: new mongoose.Types.ObjectId(user.sub),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      lessonId: input.lessonId
        ? new mongoose.Types.ObjectId(input.lessonId)
        : undefined,
      quizId: input.quizId
        ? new mongoose.Types.ObjectId(input.quizId)
        : undefined,
      flashcardId: input.flashcardId
        ? new mongoose.Types.ObjectId(input.flashcardId)
        : undefined,
      title: input.title?.trim() || "Untitled note",
      content: input.content,
    });

    return await this.toResponse(created);
  }

  static async delete(user: JwtPayload, noteId: string) {
    const note = await StudentNote.findOne({ _id: noteId, userId: user.sub });
    if (!note) throw new AppError("Note not found", 404);
    await note.deleteOne();
  }

  private static async toResponse(note: InstanceType<typeof StudentNote>) {
    const lessonId = note.lessonId?.toString();
    let lessonTitle: string | null = null;
    if (lessonId) {
      const lesson = await Lesson.findById(lessonId).select("title");
      lessonTitle = lesson?.title ?? "Lesson";
    }
    return {
      id: note._id.toString(),
      title: note.title,
      content: note.content,
      lessonId,
      lessonTitle,
      quizId: note.quizId?.toString(),
      flashcardId: note.flashcardId?.toString(),
      isGeneral: !lessonId && !note.quizId && !note.flashcardId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
