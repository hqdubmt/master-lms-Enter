import type { FastifyPluginAsync } from "fastify";

export const quizRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:lessonId",      async () => { /* TODO: get quiz */ });
  app.post("/:lessonId/submit", async () => { /* TODO: submit */ });
};
