import Fastify from "fastify";
import cors from "@fastify/cors";
import { startEventsConsumer } from "./consumers/events.consumer.js";
import { createEmailWorker } from "./workers/email.worker.js";
import { notificationRoutes } from "./routes/notifications.js";

const PORT = parseInt(process.env.PORT ?? "3005", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "notification-service",
  }));

  await app.register(notificationRoutes, { prefix: "/api/v1/notifications" });

  // Start BullMQ email worker
  const worker = createEmailWorker();
  app.log.info("[notification] Email worker started");

  // Start Kafka consumer (non-blocking)
  startEventsConsumer().catch((err) => {
    app.log.error("[notification] Kafka consumer error:", err);
  });

  const shutdown = async () => {
    await worker.close();
    await app.close();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`notification-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
