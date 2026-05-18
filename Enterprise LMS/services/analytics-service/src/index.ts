import Fastify from "fastify";
import cors from "@fastify/cors";
import { startEventsConsumer } from "./consumers/events.consumer.js";
import { analyticsRoutes } from "./routes/analytics.js";

const PORT = parseInt(process.env.PORT ?? "3004", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  app.get("/health", async () => ({ status: "ok", service: "analytics-service" }));

  await app.register(analyticsRoutes, { prefix: "/api/v1" });

  // Start Kafka consumer (non-blocking)
  startEventsConsumer().catch((err) => {
    app.log.error("[analytics] Kafka consumer error:", err);
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`analytics-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
