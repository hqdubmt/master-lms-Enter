import { Kafka } from "kafkajs";
import type { AppEvent, LessonCompletedEvent, QuizSubmittedEvent } from "@lms/types";
import { addPoints } from "../services/gamification.service.js";

const TOPIC = "lms-events";
const GROUP_ID = "game-group";

async function handleLessonCompleted(event: LessonCompletedEvent): Promise<void> {
  await addPoints(event.userId, event.schoolId, 10, "lesson_completed");
}

async function handleQuizSubmitted(event: QuizSubmittedEvent): Promise<void> {
  const percentage =
    event.maxScore > 0 ? (event.score / event.maxScore) * 100 : 0;

  if (percentage >= 80) {
    await addPoints(event.userId, event.schoolId, 25, "quiz_passed");
  }
}

export async function startEventsConsumer(): Promise<void> {
  const kafka = new Kafka({
    brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  });

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
        console.error("[game-consumer] Failed to parse event:", err);
        return;
      }

      try {
        if (event.type === "lesson.completed") {
          await handleLessonCompleted(event);
        } else if (event.type === "quiz.submitted") {
          await handleQuizSubmitted(event);
        }
      } catch (err) {
        console.error("[game-consumer] Failed to handle event:", err);
      }
    },
  });

  const shutdown = async () => {
    await consumer.disconnect();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
