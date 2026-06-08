import mongoose from "mongoose";
import { ProcessingStatus } from "../../../shared/enums/processingStatus.enum";
import { Status } from "../../../shared/enums/status.enum";
import { LessonProgressStatus } from "../../../shared/enums/progress.enum";
import { AccessControlService } from "../../../shared/services/accessControl.service";
import { JwtPayload } from "../../../types/express.d";
import { EnrollmentScopeService } from "../../../shared/services/enrollmentScope.service";
import Subject from "../../academic/models/subject.model";
import Topic from "../../academic/models/topic.model";
import Lesson from "../../lesson/models/lesson.model";
import LessonProgress from "../../progress/models/lessonProgress.model";
import FlashcardProgress from "../../progress/models/flashcardProgress.model";
import Quiz from "../../quiz/models/quiz.model";
import QuizQuestion from "../../quiz/models/quizQuestion.model";
import Flashcard from "../../flashcard/models/flashcard.model";
import FlashcardReview from "../../progress/models/flashcardReview.model";
import { ProgressService } from "../../progress/services/progress.service";
import { SpacedRepetitionService } from "../../progress/services/spacedRepetition.service";
import { QuizService } from "../../quiz/services/quiz.service";
import { FlashcardService } from "../../flashcard/services/flashcard.service";
import { LessonService } from "../../lesson/services/lesson.service";
import { ChatService } from "../../chat/services/chat.service";
import { normalizeCreateSessionInput } from "../../chat/dto/chat.dto";
import QuizAttempt from "../../progress/models/quizAttempt.model";
import QuizDraft from "../../progress/models/quizDraft.model";
import StudentProgress from "../../progress/models/studentProgress.model";
import { AchievementService } from "../../achievements/services/achievement.service";
import { XpService } from "../../xp/services/xp.service";
import { StudentPlanLimitService } from "../../../shared/services/studentPlanLimit.service";

export class StudentPortalService {
  static async getDashboard(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const base = await ProgressService.getDashboard(user, organizationId);

    const [dueCards, pendingQuizzes, inProgress] = await Promise.all([
      FlashcardProgress.countDocuments({
        userId: user.sub,
        organizationId,
        nextReviewAt: { $lte: new Date() },
      }),
      this.countPendingQuizzes(user.sub, organizationId),
      LessonProgress.find({
        userId: user.sub,
        organizationId,
        status: LessonProgressStatus.IN_PROGRESS,
      })
        .sort({ lastAccessedAt: -1 })
        .limit(5),
    ]);

    const lessonIds = inProgress.map((p) => p.lessonId);
    const lessons = await Lesson.find({ _id: { $in: lessonIds } }).select("title");
    const progressByLesson = new Map(
      inProgress.map((p) => [p.lessonId.toString(), p])
    );

    const progress = await StudentProgress.findOne({
      userId: user.sub,
      organizationId,
    });

    const [orgRank, globalRank] = await Promise.all([
      XpService.getUserRank(user.sub, organizationId, "organization"),
      XpService.getUserRank(user.sub, organizationId, "global"),
    ]);

    await AchievementService.checkUnlocks(user.sub, organizationId);

    const recommendations = await this.getRecommendations(
      user,
      organizationId
    );

    return {
      ...base,
      currentLessons: lessons.map((l) => {
        const lp = progressByLesson.get(l._id.toString());
        return {
          id: l._id.toString(),
          title: l.title,
          progressPercent: lp?.progressPercent ?? 0,
          status: lp?.status,
        };
      }),
      nextReviews: dueCards,
      recommendedLessons: recommendations.nextLessons,
      weakTopics:
        recommendations.weakTopics.length > 0
          ? recommendations.weakTopics
          : base.weakTopics,
      streak: base.currentStreak,
      completionPercentage: base.lessonCompletionRate,
      studyTime: base.totalStudyTimeMinutes,
      pendingQuizzes,
      totalXp: progress?.totalXp ?? 0,
      orgRank: orgRank.rank,
      globalRank: globalRank.rank,
    };
  }

  static async getStudyQueue(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const [flashcards, pendingQuiz] = await Promise.all([
      this.getReviewFlashcards(user, organizationId, 12),
      this.getNextPendingQuiz(user, organizationId),
    ]);

    return { flashcards, pendingQuiz };
  }

  static async getNextPendingQuiz(
    user: JwtPayload,
    organizationId: string
  ) {
    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );
    const filter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    };
    if (subjectIds.length > 0) filter.subjectId = { $in: subjectIds };

    const lessons = await Lesson.find(filter).sort({ order: 1 }).select("_id title");
    const lessonIds = lessons.map((l) => l._id);
    const lessonTitleMap = new Map(lessons.map((l) => [l._id.toString(), l.title]));

    const quizzes = await Quiz.find({
      lessonId: { $in: lessonIds },
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    });

    const attemptedQuizIds = new Set(
      (
        await QuizAttempt.find({
          userId: user.sub,
          quizId: { $in: quizzes.map((q) => q._id) },
        }).distinct("quizId")
      ).map((id) => id.toString())
    );

    const next = quizzes.find((q) => !attemptedQuizIds.has(q._id.toString()));
    if (!next) return null;

    const quizData = await QuizService.getById(user, next._id.toString(), false);
    const lessonTitle = lessonTitleMap.get(next.lessonId.toString()) ?? "Lesson";

    return {
      quizId: next._id.toString(),
      lessonId: next.lessonId.toString(),
      lessonTitle,
      title: quizData.title,
      questionCount: quizData.questions.length,
      questions: quizData.questions,
    };
  }

  static async getLeaderboard(
    user: JwtPayload,
    organizationId: string,
    scope: "organization" | "global"
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const entries =
      scope === "global"
        ? await XpService.getGlobalLeaderboard(25)
        : await XpService.getOrgLeaderboard(organizationId, 25);

    const myRank = await XpService.getUserRank(
      user.sub,
      organizationId,
      scope
    );

    return {
      scope,
      entries,
      myRank: {
        rank: myRank.rank,
        totalXp: myRank.totalXp,
        userId: user.sub,
      },
    };
  }

  static async continueLearning(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const items = await LessonProgress.find({
      userId: new mongoose.Types.ObjectId(user.sub),
      organizationId: orgOid,
      status: { $ne: LessonProgressStatus.COMPLETED },
    })
      .sort({ lastAccessedAt: -1 })
      .limit(10);

    if (!items.length) return [];

    const lessonIds = items.map((i) => i.lessonId);
    const lessons = await Lesson.find({
      _id: { $in: lessonIds },
      organizationId: orgOid,
      generationStatus: ProcessingStatus.COMPLETED,
      status: Status.ACTIVE,
    });

    const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));

    return items
      .map((p) => {
        const lesson = lessonMap.get(p.lessonId.toString());
        if (!lesson) return null;
        return {
          lessonId: lesson._id.toString(),
          title: lesson.title,
          progressPercent: p.progressPercent ?? 0,
          status: p.status,
          lastAccessedAt: p.lastAccessedAt,
          isPersonal: Boolean(lesson.isPersonal),
        };
      })
      .filter(Boolean);
  }

  static async listLessons(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );

    const lessonFilter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
      isPersonal: { $ne: true },
    };

    if (subjectIds.length > 0) {
      lessonFilter.subjectId = { $in: subjectIds };
    }

    const personalFilter: Record<string, unknown> = {
      organizationId,
      ownerId: new mongoose.Types.ObjectId(user.sub),
      isPersonal: true,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    };

    const [orgLessons, personalLessons] = await Promise.all([
      Lesson.find(lessonFilter)
        .sort({ order: 1, createdAt: -1 })
        .limit(100),
      Lesson.find(personalFilter).sort({ createdAt: -1 }).limit(100),
    ]);

    const lessons = [...orgLessons, ...personalLessons];
    const progress = await LessonProgress.find({
      userId: user.sub,
      lessonId: { $in: lessons.map((l) => l._id) },
    });
    const progressMap = new Map(progress.map((p) => [p.lessonId.toString(), p]));

    return lessons.map((l) => ({
      id: l._id.toString(),
      title: l.title,
      summary: l.summary,
      topicId: l.topicId?.toString() ?? "",
      subjectId: l.subjectId?.toString() ?? "",
      isPersonal: Boolean(l.isPersonal),
      progress: progressMap.get(l._id.toString()) ?? null,
    }));
  }

  static async getLessonDetail(
    user: JwtPayload,
    organizationId: string,
    lessonId: string
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const lesson = await LessonService.getById(user, lessonId);

    const existingProgress = await LessonProgress.findOne({
      userId: user.sub,
      lessonId,
    });

    const progressInput: {
      progressPercent?: number;
      timeSpentMinutes?: number;
    } = {};

    if (existingProgress?.status !== LessonProgressStatus.COMPLETED) {
      const current = existingProgress?.progressPercent ?? 0;
      if (current < 10) {
        progressInput.progressPercent = 10;
      }
    }

    const progressUpdate = await ProgressService.updateLessonProgress(
      user,
      lessonId,
      progressInput
    );

    const [flashcards, quizzes] = await Promise.all([
      FlashcardService.listByLesson(user, lessonId),
      Quiz.find({ lessonId, status: Status.ACTIVE }).sort({ createdAt: -1 }),
    ]);

    const quizDataList = await Promise.all(
      quizzes
        .filter((q) => q.generationStatus === ProcessingStatus.COMPLETED)
        .map((q) => QuizService.getById(user, q._id.toString(), false))
    );

    return {
      lesson,
      flashcards,
      quiz: quizDataList[0] ?? null,
      quizzes: quizDataList,
      progress: {
        status: progressUpdate.status,
        progressPercent: progressUpdate.progressPercent,
        timeSpentMinutes: progressUpdate.timeSpentMinutes,
        completedAt: progressUpdate.completedAt,
      },
    };
  }

  static async completeLesson(
    user: JwtPayload,
    lessonId: string
  ) {
    return ProgressService.updateLessonProgress(user, lessonId, {
      markComplete: true,
      progressPercent: 100,
    });
  }

  static async getReviewFlashcards(
    user: JwtPayload,
    organizationId: string,
    limit = 20
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const due = await SpacedRepetitionService.getDueCards(
      user.sub,
      organizationId,
      limit
    );

    return due.map((entry) => {
      const card = entry.flashcardId as unknown as {
        _id: { toString(): string };
        question: string;
        answer: string;
        lessonId: { toString(): string };
        difficulty: string;
      };
      return {
        progressId: entry._id.toString(),
        flashcardId: card?._id?.toString?.() ?? entry.flashcardId.toString(),
        lessonId: card?.lessonId?.toString?.() ?? "",
        question: card?.question ?? "",
        answer: card?.answer ?? "",
        difficulty: card?.difficulty ?? "",
        nextReviewAt: entry.nextReviewAt,
      };
    });
  }

  static async getRecommendations(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const userOid = new mongoose.Types.ObjectId(user.sub);

    const progress = await StudentProgress.findOne({
      userId: userOid,
      organizationId: orgOid,
    });

    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );

    const lessonFilter: Record<string, unknown> = {
      organizationId: orgOid,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    };
    if (subjectIds.length > 0) {
      lessonFilter.subjectId = {
        $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const scopedLessonIds = await Lesson.find(lessonFilter).distinct("_id");

    const [completedIds, startedIds] = await Promise.all([
      LessonProgress.find({
        userId: userOid,
        lessonId: { $in: scopedLessonIds },
        status: LessonProgressStatus.COMPLETED,
      }).distinct("lessonId"),
      LessonProgress.find({
        userId: userOid,
        lessonId: { $in: scopedLessonIds },
      }).distinct("lessonId"),
    ]);

    const mapLesson = (l: {
      _id: mongoose.Types.ObjectId;
      title: string;
      summary?: string;
      topicId?: mongoose.Types.ObjectId;
      subjectId?: mongoose.Types.ObjectId;
    }) => ({
      id: l._id.toString(),
      title: l.title,
      summary: l.summary,
      topicId: l.topicId?.toString() ?? "",
      subjectId: l.subjectId?.toString() ?? "",
    });

    // Prefer lessons never started, then in-progress / not completed
    let lessons = await Lesson.find({
      ...lessonFilter,
      _id: { $nin: startedIds },
    })
      .sort({ order: 1, createdAt: 1 })
      .limit(8)
      .select("title summary topicId subjectId");

    if (lessons.length < 5) {
      const more = await Lesson.find({
        ...lessonFilter,
        _id: { $nin: completedIds, $in: startedIds },
      })
        .sort({ order: 1, updatedAt: -1 })
        .limit(8)
        .select("title summary topicId subjectId");

      const seen = new Set(lessons.map((l) => l._id.toString()));
      for (const lesson of more) {
        const id = lesson._id.toString();
        if (!seen.has(id)) {
          lessons.push(lesson);
          seen.add(id);
        }
      }
    }

    if (lessons.length === 0 && scopedLessonIds.length > 0) {
      lessons = await Lesson.find({ _id: { $in: scopedLessonIds } })
        .sort({ order: 1, createdAt: 1 })
        .limit(5)
        .select("title summary topicId subjectId");
    }

    return {
      nextLessons: lessons.slice(0, 5).map(mapLesson),
      weakTopics: progress?.weakTopics ?? [],
      revisionSuggestions: (progress?.weakTopics ?? []).slice(0, 5).map((t) => ({
        topic: t,
        reason: "Low quiz performance or flashcard difficulty",
      })),
    };
  }

  static async getLearningPath(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );

    const subjects = await Subject.find({
      organizationId,
      status: Status.ACTIVE,
      ...(subjectIds.length > 0 ? { _id: { $in: subjectIds } } : {}),
    }).sort({ order: 1 });

    const path = [];
    for (const subject of subjects) {
      const topics = await Topic.find({
        organizationId,
        subjectId: subject._id,
        status: Status.ACTIVE,
      }).sort({ order: 1 });

      for (const topic of topics) {
        const lessons = await Lesson.find({
          organizationId,
          topicId: topic._id,
          status: Status.ACTIVE,
          generationStatus: ProcessingStatus.COMPLETED,
        }).sort({ order: 1 });

        path.push({
          subjectId: subject._id.toString(),
          subjectName: subject.name,
          topicId: topic._id.toString(),
          topicName: topic.name,
          lessons: lessons.map((l) => ({
            id: l._id.toString(),
            title: l.title,
            order: l.order,
          })),
        });
      }
    }

    return { path };
  }

  static async getRevisionPlan(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const [dueCount, progress, weakTopics] = await Promise.all([
      FlashcardProgress.countDocuments({
        userId: user.sub,
        organizationId,
        nextReviewAt: { $lte: new Date() },
      }),
      StudentProgress.findOne({ userId: user.sub, organizationId }),
      QuizAttempt.find({ userId: user.sub, organizationId, score: { $lt: 70 } })
        .sort({ completedAt: -1 })
        .limit(5),
    ]);

    const schedule = [];
    if (dueCount > 0) {
      schedule.push({
        type: "flashcards",
        priority: 1,
        itemCount: dueCount,
        suggestedMinutes: Math.min(30, dueCount * 2),
      });
    }
    for (const topic of (progress?.weakTopics ?? []).slice(0, 3)) {
      schedule.push({
        type: "topic_review",
        priority: 2,
        topic,
        suggestedMinutes: 20,
      });
    }
    for (const attempt of weakTopics) {
      schedule.push({
        type: "quiz_retry",
        priority: 3,
        lessonId: attempt.lessonId.toString(),
        score: attempt.score,
        suggestedMinutes: 15,
      });
    }

    return { schedule, weakTopics: progress?.weakTopics ?? [] };
  }

  static async getHistory(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    const [quizzes, lessons, reviews] = await Promise.all([
      QuizAttempt.find({ userId: user.sub, organizationId })
        .sort({ completedAt: -1 })
        .limit(20),
      LessonProgress.find({ userId: user.sub, organizationId })
        .sort({ lastAccessedAt: -1 })
        .limit(20),
      FlashcardProgress.find({ userId: user.sub, organizationId })
        .sort({ lastReviewedAt: -1 })
        .limit(20),
    ]);

    return { quizAttempts: quizzes, lessonProgress: lessons, flashcardReviews: reviews };
  }

  static async getPractice(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);

    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      user.sub,
      organizationId
    );
    const accessOr =
      subjectIds.length > 0
        ? [
            { isPersonal: true, ownerId: user.sub },
            { isPersonal: { $ne: true }, subjectId: { $in: subjectIds } },
          ]
        : [
            { isPersonal: true, ownerId: user.sub },
            { isPersonal: { $ne: true } },
          ];

    const lessons = await Lesson.find({
      organizationId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
      $or: accessOr,
    }).select("_id title subjectId isPersonal academicYearId");
    const lessonIds = lessons.map((l) => l._id);
    const lessonTitleMap = new Map(
      lessons.map((l) => [l._id.toString(), l.title])
    );
    const lessonSubjectMap = new Map(
      lessons.map((l) => [l._id.toString(), l.subjectId?.toString() ?? ""])
    );
    const lessonPersonalMap = new Map(
      lessons.map((l) => [l._id.toString(), Boolean(l.isPersonal)])
    );

    const subjectIdSet = [
      ...new Set(lessons.map((l) => l.subjectId?.toString()).filter(Boolean)),
    ] as string[];
    const subjects = subjectIdSet.length
      ? await Subject.find({ _id: { $in: subjectIdSet } }).select("name code")
      : [];
    const subjectNameMap = new Map(
      subjects.map((s) => [s._id.toString(), s.name])
    );

    const [quizzes, flashcards, attempts, reviews, drafts] = await Promise.all([
      Quiz.find({
        lessonId: { $in: lessonIds },
        status: Status.ACTIVE,
        generationStatus: ProcessingStatus.COMPLETED,
      }),
      Flashcard.find({
        lessonId: { $in: lessonIds },
        status: Status.ACTIVE,
      }).sort({ order: 1 }),
      QuizAttempt.find({ userId: user.sub, organizationId }).sort({
        completedAt: -1,
      }),
      FlashcardReview.find({ userId: user.sub, organizationId }).sort({
        reviewedAt: -1,
      }),
      QuizDraft.find({ userId: user.sub, organizationId }),
    ]);

    const draftByQuiz = new Map(
      drafts.map((d) => [d.quizId.toString(), d])
    );

    const attemptByQuiz = new Map<string, (typeof attempts)[0]>();
    for (const a of attempts) {
      const qid = a.quizId.toString();
      if (!attemptByQuiz.has(qid)) attemptByQuiz.set(qid, a);
    }

    const reviewedFlashcardIds = new Set<string>();
    const reviewByFlashcard = new Map<string, (typeof reviews)[0]>();
    for (const r of reviews) {
      const fid = r.flashcardId.toString();
      reviewedFlashcardIds.add(fid);
      if (!reviewByFlashcard.has(fid)) reviewByFlashcard.set(fid, r);
    }

    const quizIds = quizzes.map((q) => q._id);
    const questions = await QuizQuestion.find({
      quizId: { $in: quizIds },
      status: Status.ACTIVE,
    }).sort({ order: 1 });
    const questionsByQuiz = new Map<string, typeof questions>();
    for (const q of questions) {
      const key = q.quizId.toString();
      if (!questionsByQuiz.has(key)) questionsByQuiz.set(key, []);
      questionsByQuiz.get(key)!.push(q);
    }

    const practiceQuizzes = quizzes.map((quiz) => {
      const qid = quiz._id.toString();
      const attempt = attemptByQuiz.get(qid);
      const draft = draftByQuiz.get(qid);
      const lessonIdStr = quiz.lessonId.toString();
      const lessonTitle = lessonTitleMap.get(lessonIdStr) ?? "Lesson";
      const subjectId = lessonSubjectMap.get(lessonIdStr) ?? "";
      const subjectName = subjectNameMap.get(subjectId) ?? "General";
      const quizQuestions = questionsByQuiz.get(qid) ?? [];
      const questionMap = new Map(
        quizQuestions.map((qq) => [qq._id.toString(), qq])
      );

      let answerDetails: {
        questionId: string;
        question: string;
        userAnswer: string;
        isCorrect: boolean;
        correctAnswer: string;
      }[] = [];

      if (attempt?.answers?.length) {
        answerDetails = attempt.answers.map((a) => {
          const qq = questionMap.get(a.questionId.toString());
          return {
            questionId: a.questionId.toString(),
            question: qq?.question ?? "Question",
            userAnswer: a.answer,
            isCorrect: a.isCorrect,
            correctAnswer: qq?.correctAnswer ?? "",
          };
        });
      }

      let questionsForQuiz: {
        id: string;
        question: string;
        options: string[];
        type: string;
        order: number;
      }[] = [];

      if (quizQuestions.length > 0) {
        questionsForQuiz = quizQuestions.map((qq) => ({
          id: qq._id.toString(),
          question: qq.question,
          options: qq.options ?? [],
          type: qq.type,
          order: qq.order,
        }));
      }

      let status: "completed" | "pending" | "in_progress" = attempt
        ? "completed"
        : draft
          ? "in_progress"
          : "pending";

      const totalQ = attempt?.totalQuestions ?? quizQuestions.length;
      let progressPercent = 0;
      if (attempt) {
        progressPercent = 100;
      } else if (draft && totalQ > 0) {
        const answered = draft.answers.filter((a) => a.answer?.trim()).length;
        progressPercent = Math.round((answered / totalQ) * 100);
      }

      return {
        quizId: qid,
        lessonId: lessonIdStr,
        lessonTitle,
        subjectId,
        subjectName,
        isPersonal: lessonPersonalMap.get(lessonIdStr) ?? false,
        title: quiz.title,
        setLabel: quiz.setLabel,
        difficulty: quiz.difficulty,
        status,
        progressPercent,
        score: attempt?.score,
        completedAt: attempt?.completedAt,
        totalQuestions: totalQ,
        answers: answerDetails,
        questions: questionsForQuiz,
        draft: draft
          ? {
              answers: draft.answers.map((a) => ({
                questionId: a.questionId.toString(),
                answer: a.answer,
              })),
              currentStep: draft.currentStep,
              updatedAt: draft.updatedAt,
            }
          : null,
      };
    });

    const practiceFlashcards = flashcards.map((card) => {
      const fid = card._id.toString();
      const review = reviewByFlashcard.get(fid);
      const lessonIdStr = card.lessonId.toString();
      const subjectId = lessonSubjectMap.get(lessonIdStr) ?? "";
      return {
        flashcardId: fid,
        lessonId: lessonIdStr,
        lessonTitle: lessonTitleMap.get(lessonIdStr) ?? "Lesson",
        subjectId,
        subjectName: subjectNameMap.get(subjectId) ?? "General",
        isPersonal: lessonPersonalMap.get(lessonIdStr) ?? false,
        question: card.question,
        answer: card.answer,
        status: reviewedFlashcardIds.has(fid)
          ? ("completed" as const)
          : ("pending" as const),
        lastResult: review?.result,
        reviewedAt: review?.reviewedAt,
      };
    });

    const flashcardLessonGroups = new Map<
      string,
      {
        lessonId: string;
        lessonTitle: string;
        subjectId: string;
        subjectName: string;
        isPersonal: boolean;
        total: number;
        reviewed: number;
      }
    >();
    for (const f of practiceFlashcards) {
      const key = f.lessonId;
      if (!flashcardLessonGroups.has(key)) {
        flashcardLessonGroups.set(key, {
          lessonId: f.lessonId,
          lessonTitle: f.lessonTitle,
          subjectId: f.subjectId,
          subjectName: f.subjectName,
          isPersonal: f.isPersonal,
          total: 0,
          reviewed: 0,
        });
      }
      const g = flashcardLessonGroups.get(key)!;
      g.total += 1;
      if (f.status === "completed") g.reviewed += 1;
    }

    const flashcardGroups = [...flashcardLessonGroups.values()].map((g) => ({
      ...g,
      progressPercent: g.total > 0 ? Math.round((g.reviewed / g.total) * 100) : 0,
      flashcards: practiceFlashcards.filter((f) => f.lessonId === g.lessonId),
    }));

    return {
      quizzes: practiceQuizzes,
      flashcards: practiceFlashcards,
      flashcardGroups,
      summary: {
        quizzesPending: practiceQuizzes.filter(
          (q) => q.status === "pending" || q.status === "in_progress"
        ).length,
        quizzesCompleted: practiceQuizzes.filter((q) => q.status === "completed").length,
        flashcardsPending: practiceFlashcards.filter((f) => f.status === "pending").length,
        flashcardsCompleted: practiceFlashcards.filter((f) => f.status === "completed").length,
      },
    };
  }

  static async getAchievements(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await AchievementService.checkUnlocks(user.sub, organizationId);
    return AchievementService.listForUser(user.sub, organizationId);
  }

  static async getSubscription(user: JwtPayload, organizationId: string) {
    await AccessControlService.assertOrgRead(user, organizationId);
    return StudentPlanLimitService.getUsageSnapshot(organizationId, user.sub);
  }

  static async studentChat(
    user: JwtPayload,
    organizationId: string,
    message: string,
    options?: {
      sessionId?: string;
      lessonId?: string;
      topicId?: string;
      materialId?: string;
      quizId?: string;
      flashcardId?: string;
    }
  ) {
    await AccessControlService.assertOrgRead(user, organizationId);
    await StudentPlanLimitService.assertChatMessage(organizationId, user.sub);

    if (options?.sessionId) {
      const response = await ChatService.sendMessage(user, options.sessionId, {
        message,
      });
      return { ...response, sessionId: options.sessionId };
    }

    const session = await ChatService.createSession(
      user,
      normalizeCreateSessionInput({
        organizationId,
        lessonId: options?.lessonId,
        topicId: options?.topicId,
        materialId: options?.materialId,
        quizId: options?.quizId,
        flashcardId: options?.flashcardId,
        title: "Student Tutor",
      })
    );
    const response = await ChatService.sendMessage(user, session.id, { message });
    return { ...response, sessionId: session.id };
  }

  private static async countPendingQuizzes(
    userId: string,
    organizationId: string
  ): Promise<number> {
    const subjectIds = await EnrollmentScopeService.getStudentSubjectIds(
      userId,
      organizationId
    );
    const filter: Record<string, unknown> = {
      organizationId,
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    };
    if (subjectIds.length > 0) filter.subjectId = { $in: subjectIds };

    const lessons = await Lesson.find(filter).select("_id");
    const lessonIds = lessons.map((l) => l._id);

    const quizzes = await Quiz.find({
      lessonId: { $in: lessonIds },
      status: Status.ACTIVE,
      generationStatus: ProcessingStatus.COMPLETED,
    });

    const attemptedQuizIds = await QuizAttempt.find({
      userId,
      quizId: { $in: quizzes.map((q) => q._id) },
    }).distinct("quizId");

    return quizzes.length - attemptedQuizIds.length;
  }
}
