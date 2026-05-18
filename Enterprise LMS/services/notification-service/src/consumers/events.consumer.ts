import { Queue } from "bullmq";
import type { AppEvent, UserCreatedEvent, QuizSubmittedEvent } from "@lms/types";
import { kafka } from "../lib/kafka.js";
import { redis } from "../lib/redis.js";
import type { EmailJobData } from "../workers/email.worker.js";

const TOPIC = "lms-events";
const GROUP_ID = "notification-group";

const emailQueue = new Queue<EmailJobData>("email-jobs", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

async function handleUserCreated(event: UserCreatedEvent): Promise<void> {
  // We don't have the display name from the event; use email prefix as fallback
  const name = event.email.split("@")[0] ?? "Learner";

  await emailQueue.add(
    "welcome",
    {
      type: "welcome",
      email: event.email,
      name,
    },
    { jobId: `welcome-${event.userId}-${event.eventId}` }
  );
}

async function handleQuizSubmitted(event: QuizSubmittedEvent): Promise<void> {
  const percentage =
    event.maxScore > 0 ? (event.score / event.maxScore) * 100 : 0;

  if (percentage < 80) return;

  // We don't have the email in the quiz event; we skip if no user-email mapping is available.
  // In a real system, this would look up the user's email from auth-service or a shared cache.
  // Here we emit the job with the userId so a resolver step could enrich it.
  // For a fully self-contained implementation we log and skip when email is unavailable.
  console.log(
    `[notification-consumer] Quiz passed (${Math.round(percentage)}%) for user ${event.userId}, quiz ${event.quizId}`
  );
}

export async function startEventsConsumer(): Promise<void> {
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: AppEvent;
      try {
        event = JSON.parse(message.value.toString()) as AppEvent;
      } catch (err) {
        console.error("[notification-consumer] Failed to parse event:", err);
        return;
      }

      try {
        if (event.type === "user.created") {
          await handleUserCreated(event);
        } else if (event.type === "quiz.submitted") {
          await handleQuizSubmitted(event);
        }
      } catch (err) {
        console.error("[notification-consumer] Failed to handle event:", err);
      }
    },
  });

  const shutdown = async () => {
    await consumer.disconnect();
    await emailQueue.close();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export { emailQueue };
