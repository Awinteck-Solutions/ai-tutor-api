import { Queue, Worker, Job } from "bullmq";
import { env } from "../../config/env";

export enum JobType {
  PROCESS_MATERIAL = "PROCESS_MATERIAL",
  GENERATE_LESSON = "GENERATE_LESSON",
  GENERATE_FLASHCARDS = "GENERATE_FLASHCARDS",
  GENERATE_QUIZ = "GENERATE_QUIZ",
}

export interface ProcessMaterialJobData {
  materialId: string;
  organizationId: string;
}

export interface GenerateLessonJobData {
  lessonId: string;
  materialIds?: string[];
}

export interface GenerateFlashcardsJobData {
  flashcardSetId: string;
  lessonId: string;
  count?: number;
  difficulty?: string;
}

export interface GenerateQuizJobData {
  quizId: string;
  lessonId: string;
  count?: number;
  difficulty?: string;
}

const connection = { url: env.redis.url };

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      })
    );
  }
  return queues.get(name)!;
}

export async function enqueueJob<T>(
  queueName: string,
  jobName: JobType,
  data: T
): Promise<string> {
  const queue = getQueue(queueName);
  const job = await queue.add(jobName, data);
  return job.id ?? "";
}

export async function getJobStatus(queueName: string, jobId: string) {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id,
    name: job.name,
    state,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    data: job.data,
  };
}

export type QueueJobState =
  | "completed"
  | "failed"
  | "active"
  | "waiting"
  | "delayed";

export interface QueueJobSummary {
  id: string;
  jobId: string;
  name: string;
  state: QueueJobState;
  failedReason?: string;
  attemptsMade: number;
  finishedOn?: number;
  finishedAt?: number;
  processedOn?: number;
  timestamp: number;
  data: unknown;
}

function mapJob(job: Job, state: QueueJobState): QueueJobSummary {
  const finishedOn = job.finishedOn ?? undefined;
  return {
    id: job.id ?? "",
    jobId: job.id ?? "",
    name: job.name,
    state,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    finishedOn,
    finishedAt: finishedOn,
    processedOn: job.processedOn ?? undefined,
    timestamp: job.timestamp,
    data: job.data,
  };
}

export async function listFailedJobs(queueName: string, limit = 50) {
  const jobs = await listQueueJobs(queueName, { limit, status: "failed" });
  return jobs;
}

export async function listQueueJobs(
  queueName: string,
  options: { limit?: number; status?: "all" | QueueJobState } = {}
): Promise<QueueJobSummary[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  const status = options.status ?? "all";
  const queue = getQueue(queueName);

  const fetchByState = async (state: QueueJobState) => {
    const end = limit - 1;
    switch (state) {
      case "completed":
        return (await queue.getCompleted(0, end)).map((j) => mapJob(j, state));
      case "failed":
        return (await queue.getFailed(0, end)).map((j) => mapJob(j, state));
      case "active":
        return (await queue.getActive(0, end)).map((j) => mapJob(j, state));
      case "waiting":
        return (await queue.getWaiting(0, end)).map((j) => mapJob(j, state));
      case "delayed":
        return (await queue.getDelayed(0, end)).map((j) => mapJob(j, state));
      default:
        return [];
    }
  };

  let jobs: QueueJobSummary[] = [];

  if (status === "all") {
    const perState = Math.max(Math.ceil(limit / 5), 10);
    const batches = await Promise.all([
      fetchByState("completed").then((j) => j.slice(0, perState)),
      fetchByState("failed").then((j) => j.slice(0, perState)),
      fetchByState("active").then((j) => j.slice(0, perState)),
      fetchByState("waiting").then((j) => j.slice(0, perState)),
      fetchByState("delayed").then((j) => j.slice(0, perState)),
    ]);
    jobs = batches.flat();
  } else {
    jobs = await fetchByState(status);
  }

  const seen = new Set<string>();
  const unique = jobs.filter((job) => {
    if (!job.id || seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });

  unique.sort((a, b) => {
    const aTime = a.finishedOn ?? a.processedOn ?? a.timestamp;
    const bTime = b.finishedOn ?? b.processedOn ?? b.timestamp;
    return bTime - aTime;
  });

  return unique.slice(0, limit);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
}

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>
): Worker {
  return new Worker(queueName, processor, { connection });
}
