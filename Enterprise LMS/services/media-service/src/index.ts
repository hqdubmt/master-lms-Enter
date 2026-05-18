import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createTranscodeWorker } from "./workers/transcode.worker.js";
import { mediaRoutes } from "./routes/media.js";
import { ensureBucket } from "./services/storage.service.js";
import { redis } from "./lib/redis.js";

const PORT = parseInt(process.env.PORT ?? "3007", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(2 * 1024 * 1024 * 1024), 10), // 2 GB
      files: 1,
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "media-service",
  }));

  await app.register(mediaRoutes, { prefix: "/api/v1/media" });

  // Ensure MinIO bucket exists
  await ensureBucket();
  app.log.info("[media] MinIO bucket ready");

  // Start BullMQ transcode worker
  const worker = createTranscodeWorker();
  app.log.info("[media] Transcode worker started");

  const shutdown = async () => {
    await worker.close();
    await redis.quit();
    await app.close();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`media-service running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
