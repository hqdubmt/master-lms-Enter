import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@lms/types";

import { LlmService, type ChatMessage } from "../services/llm.service.js";
import { VectorService } from "../services/vector.service.js";
import { QuizGenerator } from "../services/quiz.generator.js";
import { AiChat } from "../models/ai-chat.model.js";

// ─── Shared singletons ───────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queueEventsConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const aiQueue = new Queue("ai-jobs", { connection: queueConnection });
const queueEvents = new QueueEvents("ai-jobs", { connection: queueEventsConnection });

const llm = new LlmService();
const vectorService = new VectorService();
const quizGen = new QuizGenerator(llm);

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const ChatBodySchema = z.object({
  message: z.string().min(1).max(10_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  sessionId: z.string().optional(),
});

const ExplainBodySchema = z.object({
  text: z.string().min(1).max(50_000),
});

const QuizBodySchema = z.object({
  text: z.string().min(1).max(50_000),
  count: z.number().int().min(1).max(20).optional().default(5),
});

const SearchBodySchema = z.object({
  query: z.string().min(1).max(1_000),
  schoolId: z.number().int().positive(),
});

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getUser(request: FastifyRequest): JwtPayload {
  return (request as FastifyRequest & { user: JwtPayload }).user;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const aiRoutes: FastifyPluginAsync = async (app) => {
  // All routes require a valid JWT
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ success: false, error: "Unauthorized" });
    }
  });

  // ── POST /chat ────────────────────────────────────────────────────────────
  app.post("/chat", async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = ChatBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ success: false, error: parseResult.error.message });
    }

    const { message, history, sessionId: rawSessionId } = parseResult.data;
    const user = getUser(request);
    const sessionId = rawSessionId ?? `${user.sub}-${Date.now()}`;

    const messages: ChatMessage[] = [
      ...history.map((h) => ({ role: h.role as ChatMessage["role"], content: h.content })),
      { role: "user", content: message },
    ];

    // Enqueue chat job
    const job = await aiQueue.add(
      "chat",
      { messages, userId: user.sub, sessionId },
      { attempts: 2, backoff: { type: "exponential", delay: 1000 } }
    );

    // Wait for worker to finish (max 30 s)
    const result = (await job.waitUntilFinished(queueEvents, 30_000)) as { reply: string };
    const replyText = result?.reply ?? "";

    // Persist chat history to MongoDB (non-blocking on error)
    try {
      await AiChat.findOneAndUpdate(
        { userId: user.sub, sessionId },
        {
          $push: {
            messages: {
              $each: [
                { role: "user", content: message, timestamp: new Date() },
                { role: "assistant", content: replyText, timestamp: new Date() },
              ],
            },
          },
          $setOnInsert: { userId: user.sub, sessionId },
        },
        { upsert: true, new: true }
      );
    } catch (mongoErr) {
      app.log.warn({ err: mongoErr }, "[chat] MongoDB save failed (non-fatal)");
    }

    return reply.send({ success: true, data: { reply: replyText, sessionId } });
  });

  // ── POST /explain ─────────────────────────────────────────────────────────
  app.post("/explain", async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = ExplainBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ success: false, error: parseResult.error.message });
    }

    const { text } = parseResult.data;

    const systemPrompt =
      "You are an educational tutor. Explain the given content clearly using simple language. " +
      "Break down complex concepts and use examples where helpful.";

    const messages: ChatMessage[] = [
      { role: "user", content: `Please explain the following content:\n\n${text}` },
    ];

    const explanation = await llm.chat(messages, systemPrompt);

    return reply.send({ success: true, data: { explanation } });
  });

  // ── POST /quiz/generate ───────────────────────────────────────────────────
  app.post("/quiz/generate", async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = QuizBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ success: false, error: parseResult.error.message });
    }

    const { text, count } = parseResult.data;

    const questions = await quizGen.generateFromText(text, count);

    return reply.send({ success: true, data: { questions } });
  });

  // ── POST /search ──────────────────────────────────────────────────────────
  app.post("/search", async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = SearchBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ success: false, error: parseResult.error.message });
    }

    const { query, schoolId } = parseResult.data;

    const queryVector = await llm.embed(query);
    const results = await vectorService.search(queryVector, schoolId, 5);

    return reply.send({ success: true, data: { results } });
  });
};
