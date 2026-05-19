import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import type { JwtPayload } from "@lms/types";
import { RoomService } from "./services/room.service";
import { PubSubService } from "./services/pubsub.service";
import { createRealtimeRoutes } from "./routes/realtime";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function main() {
  const PORT = parseInt(process.env.PORT ?? "3008", 10);
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
  await app.register(websocket, { options: { maxPayload: 1_048_576 } });

  const roomService = new RoomService();
  const pubsub = new PubSubService();

  app.get("/health", async () => ({
    status: "ok",
    service: "realtime-gateway",
    rooms: roomService.getRoomIds().length,
  }));

  await app.register(createRealtimeRoutes(roomService, pubsub));

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} — shutting down`);
    await pubsub.quit();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`realtime-gateway running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
