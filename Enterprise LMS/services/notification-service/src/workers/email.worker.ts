import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import {
  sendWelcome,
  sendCourseEnrolled,
  sendQuizResult,
  sendEmail,
} from "../services/notification.service.js";

export interface WelcomeJobData {
  type: "welcome";
  email: string;
  name: string;
}

export interface CourseEnrolledJobData {
  type: "course-enrolled";
  email: string;
  courseName: string;
}

export interface QuizResultJobData {
  type: "quiz-result";
  email: string;
  score: number;
  maxScore: number;
  courseName: string;
}

export interface ManualEmailJobData {
  type: "manual";
  to: string;
  subject: string;
  html: string;
}

export type EmailJobData =
  | WelcomeJobData
  | CourseEnrolledJobData
  | QuizResultJobData
  | ManualEmailJobData;

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const data = job.data;

  switch (data.type) {
    case "welcome":
      await sendWelcome(data.email, data.name);
      break;

    case "course-enrolled":
      await sendCourseEnrolled(data.email, data.courseName);
      break;

    case "quiz-result":
      await sendQuizResult(data.email, data.score, data.maxScore, data.courseName);
      break;

    case "manual":
      await sendEmail(data.to, data.subject, data.html);
      break;

    default: {
      const exhaustive: never = data;
      throw new Error(`Unknown email job type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>("email-jobs", processEmailJob, {
    connection: redis,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[email-worker] Job ${job.id} completed (type: ${job.data.type})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[email-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
