import type { WebSocket } from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { RoomService } from "../services/room.service.js";
import { PubSubService } from "../services/pubsub.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JwtPayload {
  sub: number;
  schoolId: number;
  role: string;
  displayName?: string;
}

interface ClientEvent {
  type: string;
  roomId?: string;
  token?: string;
  text?: string;
  questionId?: string;
  answer?: number | string;
}

interface QuizQuestionStats {
  counts: Record<string, number>;
  correctAnswer: string | number;
}

type QuizAnswerTracker = Record<string, QuizQuestionStats>;

// ─── Quiz answer tracking (in-memory per gateway instance) ───────────────────

const quizAnswers: Map<string, QuizAnswerTracker> = new Map();

// ─── Classroom handler ────────────────────────────────────────────────────────

export function createClassroomHandler(
  app: FastifyInstance,
  roomService: RoomService,
  pubsub: PubSubService
) {
  return async function handleClassroom(socket: WebSocket): Promise<void> {
    let userId: number | null = null;
    let displayName = "Anonymous";
    let currentRoomId: string | null = null;

    const sendToSocket = (socket: WebSocket, data: object) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    };

    // ── Cross-instance broadcast via Redis pub/sub ────────────────────────
    const handleRoomBroadcast = (data: object) => {
      if (!currentRoomId) return;
      const msg = data as { excludeUserId?: number; payload: object };
      if (msg.excludeUserId === userId) return;
      sendToSocket(socket, msg.payload);
    };

    socket.on("message", async (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let event: ClientEvent;

      try {
        event = JSON.parse(raw.toString()) as ClientEvent;
      } catch {
        sendToSocket(socket, { type: "error", message: "Invalid JSON" });
        return;
      }

      // ── join ────────────────────────────────────────────────────────────
      if (event.type === "join") {
        if (!event.roomId || !event.token) {
          sendToSocket(socket, { type: "error", message: "roomId and token required" });
          return;
        }

        // Verify JWT
        try {
          const payload = app.jwt.verify<JwtPayload>(event.token);
          userId = payload.sub;
          displayName = payload.displayName ?? `User-${userId}`;
        } catch {
          sendToSocket(socket, { type: "error", message: "Invalid token" });
          socket.close(4001, "Unauthorized");
          return;
        }

        currentRoomId = event.roomId;
        roomService.join(currentRoomId, socket);

        // Subscribe to cross-instance pub/sub for this room
        pubsub.subscribe(`room:${currentRoomId}`, handleRoomBroadcast);

        // Broadcast user-joined to everyone in the room (including other instances)
        await pubsub.publish(`room:${currentRoomId}`, {
          excludeUserId: null,
          payload: {
            type: "user-joined",
            userId,
            displayName,
            roomSize: roomService.getRoomSize(currentRoomId),
          },
        });

        // Confirm join to this socket
        sendToSocket(socket, {
          type: "joined",
          roomId: currentRoomId,
          userId,
          roomSize: roomService.getRoomSize(currentRoomId),
        });

        return;
      }

      // All subsequent events require a valid join
      if (!userId || !currentRoomId) {
        sendToSocket(socket, { type: "error", message: "Must join a room first" });
        return;
      }

      switch (event.type) {
        // ── message ────────────────────────────────────────────────────────
        case "message": {
          if (!event.text?.trim()) {
            sendToSocket(socket, { type: "error", message: "Empty message" });
            break;
          }

          const outbound = {
            type: "message",
            userId,
            displayName,
            text: event.text.trim(),
            timestamp: new Date().toISOString(),
          };

          // Broadcast via pub/sub for multi-instance delivery
          await pubsub.publish(`room:${currentRoomId}`, {
            excludeUserId: null,
            payload: outbound,
          });
          break;
        }

        // ── quiz:answer ────────────────────────────────────────────────────
        case "quiz:answer": {
          if (!event.questionId || event.answer === undefined) {
            sendToSocket(socket, { type: "error", message: "questionId and answer required" });
            break;
          }

          const roomKey = currentRoomId;
          if (!quizAnswers.has(roomKey)) {
            quizAnswers.set(roomKey, {});
          }

          const tracker = quizAnswers.get(roomKey)!;
          const qid = event.questionId;

          if (!tracker[qid]) {
            tracker[qid] = { counts: {}, correctAnswer: "" };
          }

          const answerKey = String(event.answer);
          tracker[qid].counts[answerKey] = (tracker[qid].counts[answerKey] ?? 0) + 1;

          // Build stats for broadcasting
          const { counts, correctAnswer } = tracker[qid];
          const stats = Object.entries(counts).map(([ans, cnt]) => ({ answer: ans, count: cnt }));

          await pubsub.publish(`room:${currentRoomId}`, {
            excludeUserId: null,
            payload: {
              type: "quiz:result",
              questionId: qid,
              correctAnswer,
              stats,
              totalAnswers: stats.reduce((sum, s) => sum + s.count, 0),
            },
          });
          break;
        }

        // ── raise-hand ─────────────────────────────────────────────────────
        case "raise-hand": {
          await pubsub.publish(`room:${currentRoomId}`, {
            excludeUserId: userId,
            payload: {
              type: "hand-raised",
              userId,
              displayName,
              timestamp: new Date().toISOString(),
            },
          });
          break;
        }

        // ── leave ──────────────────────────────────────────────────────────
        case "leave": {
          const leavingRoom = currentRoomId;
          await leaveRoom();
          sendToSocket(socket, { type: "left", roomId: leavingRoom });
          break;
        }

        default: {
          sendToSocket(socket, { type: "error", message: `Unknown event type: ${event.type}` });
        }
      }
    });

    socket.on("close", async () => {
      await leaveRoom();
    });

    socket.on("error", (err: Error) => {
      app.log.error({ err, userId, roomId: currentRoomId }, "[classroom] WebSocket error");
    });

    async function leaveRoom() {
      if (!currentRoomId || !userId) return;

      roomService.leave(currentRoomId, socket);
      pubsub.unsubscribe(`room:${currentRoomId}`, handleRoomBroadcast);

      await pubsub.publish(`room:${currentRoomId}`, {
        excludeUserId: userId,
        payload: {
          type: "user-left",
          userId,
          displayName,
          roomSize: roomService.getRoomSize(currentRoomId),
        },
      });

      currentRoomId = null;
      userId = null;
    }
  };
}
