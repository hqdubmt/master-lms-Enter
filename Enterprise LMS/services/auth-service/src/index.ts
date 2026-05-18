import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { Redis } from "ioredis";
import type { JwtPayload } from "@lms/types";
import { JwtService } from "./services/jwt.service";
import { PasswordService } from "./services/password.service";
import { AuthService } from "./services/auth.service";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";

// ─── Fastify type augmentation ───────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    jwtService: JwtService;
    authService: AuthService;
    redis: Redis;
  }

  interface FastifyRequest {
    user: JwtPayload;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Redis ──
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    app.log.error({ err }, "Redis connection error");
  });

  await redis.connect();
  app.log.info("Redis connected");

  // ── Services ──
  const jwtService = new JwtService();
  const passwordService = new PasswordService();
  const authService = new AuthService(jwtService, passwordService, redis);

  // Decorate Fastify instance so routes can access them
  app.decorate("jwtService", jwtService);
  app.decorate("authService", authService);
  app.decorate("redis", redis);

  // ── Plugins ──
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET ?? process.env.JWT_SECRET ?? "changeme",
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req) =>
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ??
      req.ip,
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: `Too many requests — retry after ${context.after}`,
    }),
  });

  // ── Health check ──
  app.get("/health", async () => ({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  }));

  // ── Routes ──
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });

  // ── Global error handler ──
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      success: false,
      error:
        statusCode === 500
          ? "Internal server error"
          : (error.message ?? "Unknown error"),
    });
  });

  return { app, redis };
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function main() {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  const HOST = process.env.HOST ?? "0.0.0.0";

  const { app, redis } = await buildServer();

  // ── Graceful shutdown ──
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully…`);
    try {
      await app.close();
      await redis.quit();
      app.log.info("Server and Redis closed");
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`auth-service running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
