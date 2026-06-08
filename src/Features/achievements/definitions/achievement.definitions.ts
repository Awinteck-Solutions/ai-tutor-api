import StudentProgress from "../../progress/models/studentProgress.model";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  isUnlocked: (progress: InstanceType<typeof StudentProgress> | null) => boolean;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_lesson",
    title: "First Lesson Complete",
    description: "Complete your first lesson",
    isUnlocked: (p) => (p?.lessonsCompleted ?? 0) >= 1,
  },
  {
    id: "ten_lessons",
    title: "10 Lessons Completed",
    description: "Complete 10 lessons",
    isUnlocked: (p) => (p?.lessonsCompleted ?? 0) >= 10,
  },
  {
    id: "week_streak",
    title: "7-Day Study Streak",
    description: "Study 7 days in a row",
    isUnlocked: (p) => (p?.currentStreak ?? 0) >= 7,
  },
  {
    id: "quiz_explorer",
    title: "5 Quizzes Taken",
    description: "Complete 5 quizzes",
    isUnlocked: (p) => (p?.quizzesTaken ?? 0) >= 5,
  },
  {
    id: "high_achiever",
    title: "90%+ Average Quiz Score",
    description: "Maintain a 90% average across quizzes",
    isUnlocked: (p) =>
      Boolean(
        p &&
          p.quizzesTaken > 0 &&
          p.totalQuizScore / p.quizzesTaken >= 90
      ),
  },
  {
    id: "xp_500",
    title: "Rising Scholar",
    description: "Earn 500 XP",
    isUnlocked: (p) => (p?.totalXp ?? 0) >= 500,
  },
  {
    id: "xp_1000",
    title: "Knowledge Seeker",
    description: "Earn 1,000 XP",
    isUnlocked: (p) => (p?.totalXp ?? 0) >= 1000,
  },
];
