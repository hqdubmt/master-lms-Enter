import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import mongoose from "mongoose";
import { prisma } from "@lms/database";
import type { JwtPayload } from "@lms/types";
import { courseRoutes } from "./routes/courses";
import { moduleRoutes } from "./routes/modules";
import { lessonRoutes } from "./routes/lessons";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function main() {
  const PORT = parseInt(process.env.PORT ?? "3002", 10);
  const HOST = process.env.HOST ?? "0.0.0.0";
  const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
  const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/enterprise_lms";

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(fastifyCors, { origin: "*", credentials: true });
  await app.register(fastifyJwt, { secret: JWT_SECRET });

  app.get("/health", async () => ({
    status: "ok",
    service: "learning-service",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }));

  await app.register(courseRoutes, { prefix: "/api/courses" });
  await app.register(moduleRoutes, { prefix: "/api" });
  await app.register(lessonRoutes, { prefix: "/api" });

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      success: false,
      error: error.statusCode === 500 ? "Internal server error" : error.message,
    });
  });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} — shutting down`);
    await app.close();
    await mongoose.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await mongoose.connect(MONGODB_URI);
    app.log.info("MongoDB connected");
    await prisma.$connect();
    app.log.info("PostgreSQL connected");
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`learning-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
