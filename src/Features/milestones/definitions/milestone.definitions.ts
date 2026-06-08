import StudentProgress from "../../progress/models/studentProgress.model";

export type MilestoneTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface MilestoneDefinition {
  id: string;
  tier: MilestoneTier;
  title: string;
  description: string;
  icon: string;
  target: number;
  getCurrent: (p: InstanceType<typeof StudentProgress> | null) => number;
  isComplete: (p: InstanceType<typeof StudentProgress> | null) => boolean;
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    id: "first_step",
    tier: "bronze",
    title: "First Step",
    description: "Complete your first lesson",
    icon: "footprints",
    target: 1,
    getCurrent: (p) => p?.lessonsCompleted ?? 0,
    isComplete: (p) => (p?.lessonsCompleted ?? 0) >= 1,
  },
  {
    id: "quiz_starter",
    tier: "bronze",
    title: "Quiz Starter",
    description: "Complete your first quiz",
    icon: "target",
    target: 1,
    getCurrent: (p) => p?.quizzesTaken ?? 0,
    isComplete: (p) => (p?.quizzesTaken ?? 0) >= 1,
  },
  {
    id: "card_learner",
    tier: "bronze",
    title: "Card Learner",
    description: "Review 10 flashcards",
    icon: "layers",
    target: 10,
    getCurrent: (p) => p?.flashcardsReviewed ?? 0,
    isComplete: (p) => (p?.flashcardsReviewed ?? 0) >= 10,
  },
  {
    id: "steady_learner",
    tier: "silver",
    title: "Steady Learner",
    description: "Complete 5 lessons",
    icon: "book-open",
    target: 5,
    getCurrent: (p) => p?.lessonsCompleted ?? 0,
    isComplete: (p) => (p?.lessonsCompleted ?? 0) >= 5,
  },
  {
    id: "streak_builder",
    tier: "silver",
    title: "Streak Builder",
    description: "Reach a 3-day study streak",
    icon: "flame",
    target: 3,
    getCurrent: (p) => p?.currentStreak ?? 0,
    isComplete: (p) => (p?.currentStreak ?? 0) >= 3,
  },
  {
    id: "rising_scholar",
    tier: "gold",
    title: "Rising Scholar",
    description: "Earn 500 XP",
    icon: "zap",
    target: 500,
    getCurrent: (p) => p?.totalXp ?? 0,
    isComplete: (p) => (p?.totalXp ?? 0) >= 500,
  },
  {
    id: "quiz_master",
    tier: "gold",
    title: "Quiz Master",
    description: "Complete 10 quizzes",
    icon: "brain",
    target: 10,
    getCurrent: (p) => p?.quizzesTaken ?? 0,
    isComplete: (p) => (p?.quizzesTaken ?? 0) >= 10,
  },
  {
    id: "week_warrior",
    tier: "platinum",
    title: "Week Warrior",
    description: "Maintain a 7-day study streak",
    icon: "flame",
    target: 7,
    getCurrent: (p) => p?.currentStreak ?? 0,
    isComplete: (p) => (p?.currentStreak ?? 0) >= 7,
  },
  {
    id: "knowledge_seeker",
    tier: "platinum",
    title: "Knowledge Seeker",
    description: "Earn 1,000 XP",
    icon: "sparkles",
    target: 1000,
    getCurrent: (p) => p?.totalXp ?? 0,
    isComplete: (p) => (p?.totalXp ?? 0) >= 1000,
  },
  {
    id: "lesson_legend",
    tier: "diamond",
    title: "Lesson Legend",
    description: "Complete 25 lessons",
    icon: "trophy",
    target: 25,
    getCurrent: (p) => p?.lessonsCompleted ?? 0,
    isComplete: (p) => (p?.lessonsCompleted ?? 0) >= 25,
  },
];

export const MILESTONE_TIER_ORDER: MilestoneTier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
];
