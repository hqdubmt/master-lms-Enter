import Fastify from "fastify";
import cors from "@fastify/cors";
import { startEventsConsumer } from "./consumers/events.consumer.js";
import { gameRoutes } from "./routes/game.js";
import { redis } from "./lib/redis.js";

const PORT = parseInt(process.env.PORT ?? "3006", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "game-service",
  }));

  await app.register(gameRoutes, { prefix: "/api/v1/game" });

  // Connect Redis
  await redis.connect();
  app.log.info("[game] Redis connected");

  // Start Kafka consumer (non-blocking)
  startEventsConsumer().catch((err) => {
    app.log.error("[game] Kafka consumer error:", err);
  });

  const shutdown = async () => {
    await redis.quit();
    await app.close();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`game-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
