import { SubscriptionPlan } from "../enums/subscriptionPlan.enum";

/** Free tier limits for personal student workspaces (abuse prevention). */
export const STUDENT_FREE_LIMITS = {
  storageBytes: 10 * 1024 * 1024,
  lessonsPerDay: 10,
  materialsPerDay: 5,
  chatMessagesPerDay: 25,
  practiceGenerationsPerDay: 10,
  maxMaterialsTotal: 25,
  maxPersonalLessonsTotal: 50,
  monthlyAiRequests: 200,
  monthlyAiTokens: 100_000,
} as const;

export type StudentPlanLimitKey = keyof typeof STUDENT_FREE_LIMITS;

export interface StudentPlanPackage {
  id: SubscriptionPlan | "STUDENT_PLUS";
  name: string;
  tagline: string;
  priceLabel: string;
  comingSoon: boolean;
  recommended?: boolean;
  highlights: string[];
}

export const STUDENT_PLAN_CATALOG: StudentPlanPackage[] = [
  {
    id: SubscriptionPlan.FREE,
    name: "Free",
    tagline: "Start learning on your own",
    priceLabel: "$0 / month",
    comingSoon: false,
    recommended: true,
    highlights: [
      "10 MB file storage",
      "10 lessons created per day",
      "5 uploads per day",
      "25 AI chat messages per day",
      "10 quiz & flashcard generations per day",
    ],
  },
  {
    id: SubscriptionPlan.BASIC,
    name: "Basic",
    tagline: "More room to grow",
    priceLabel: "Coming soon",
    comingSoon: true,
    highlights: [
      "500 MB storage",
      "50 lessons per day",
      "Priority lesson generation",
      "Extended AI chat",
    ],
  },
  {
    id: SubscriptionPlan.PRO,
    name: "Pro",
    tagline: "Power learners",
    priceLabel: "Coming soon",
    comingSoon: true,
    highlights: [
      "5 GB storage",
      "Unlimited daily lessons",
      "Advanced analytics",
      "Higher AI limits",
    ],
  },
  {
    id: "STUDENT_PLUS",
    name: "Student Plus",
    tagline: "School + self-study bundle",
    priceLabel: "Coming soon",
    comingSoon: true,
    highlights: [
      "Everything in Pro",
      "Shared class workspace",
      "Teacher collaboration",
    ],
  },
];
