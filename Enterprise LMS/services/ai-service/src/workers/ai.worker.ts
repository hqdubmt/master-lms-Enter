import { Worker } from "bullmq";
import { redis } from "../lib/redis.js";
import { LlmService, type ChatMessage } from "../services/llm.service.js";
import { VectorService } from "../services/vector.service.js";
import { QuizGenerator } from "../services/quiz.generator.js";

const llm = new LlmService();
const vector = new VectorService();
const quiz = new QuizGenerator(llm);

// Ensure Qdrant collection exists at startup
vector.ensureCollection().catch((err) => {
  console.error("[ai.worker] Failed to ensure Qdrant collection:", err);
});

export const aiWorker = new Worker(
  "ai-jobs",
  async (job) => {
    switch (job.name) {
      case "chat": {
        const { messages, userId, sessionId } = job.data as {
          messages: ChatMessage[];
          userId: number;
          sessionId: string;
        };

        const reply = await llm.chat(messages);

        // Publish result to Redis pub/sub channel so the HTTP handler can pick it up
        await redis.publish(
          `ai:chat:result:${sessionId}`,
          JSON.stringify({ reply, userId, sessionId })
        );

        return { reply };
      }

      case "embed": {
        const { text, id, schoolId } = job.data as {
          text: string;
          id: string;
          schoolId: number;
        };

        const embedding = await llm.embed(text);

        await vector.upsert(id, embedding, {
          type: "content",
          schoolId,
          content: text,
        });

        return { id, dims: embedding.length };
      }

      case "quiz:generate": {
        const { text, count, lessonId } = job.data as {
          text: string;
          count?: number;
          lessonId: string;
        };

        const questions = await quiz.generateFromText(text, count ?? 5);

        // Publish result so the HTTP handler can get it
        await redis.publish(
          `ai:quiz:result:${lessonId}`,
          JSON.stringify({ questions, lessonId })
        );

        return { questions, lessonId };
      }

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  { connection: redis, concurrency: 3 }
);

aiWorker.on("completed", (job) => {
  console.log(`[ai.worker] Job ${job.id} (${job.name}) completed`);
});

aiWorker.on("failed", (job, err) => {
  console.error(`[ai.worker] Job ${job?.id} (${job?.name}) failed:`, err);
});
