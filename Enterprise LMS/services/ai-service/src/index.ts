import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import type { JwtPayload } from "@lms/types";
import { aiRoutes } from "./routes/ai";
import { connectMongo } from "./lib/mongoose";
import { VectorService } from "./services/vector.service";
import "./workers/ai.worker";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function main() {
  const PORT = parseInt(process.env.PORT ?? "3003", 10);
  const HOST = process.env.HOST ?? "0.0.0.0";
  const JWT_SECRET = process.env.JWT_SECRET ?? "change_me";

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(cors, { origin: "*", credentials: true });
  await app.register(jwt, { secret: JWT_SECRET });

  app.get("/health", async () => ({ status: "ok", service: "ai-service" }));
  await app.register(aiRoutes, { prefix: "/api/ai" });

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({ success: false, error: error.message });
  });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} — shutting down`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await connectMongo();
    const vectorService = new VectorService();
    await vectorService.ensureCollection().catch((err) => {
      app.log.warn({ err }, "Qdrant not available at startup");
    });
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`ai-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
