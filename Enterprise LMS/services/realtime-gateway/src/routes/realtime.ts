import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { RoomService } from "../services/room.service.js";
import { PubSubService } from "../services/pubsub.service.js";
import { createClassroomHandler } from "../handlers/classroom.handler.js";

export function createRealtimeRoutes(
  roomService: RoomService,
  pubsub: PubSubService
): FastifyPluginAsync {
  return async function realtimeRoutes(app: FastifyInstance) {
    const handleClassroom = createClassroomHandler(app, roomService, pubsub);

    // GET /ws — WebSocket upgrade endpoint
    app.get(
      "/ws",
      { websocket: true },
      async (socket: WebSocket) => {
        await handleClassroom(socket);
      }
    );

    // Health check for the realtime gateway
    app.get("/health/ws", async () => ({
      status: "ok",
      rooms: roomService.getRoomIds().length,
    }));
  };
}
