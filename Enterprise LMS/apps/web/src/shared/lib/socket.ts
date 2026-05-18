import { io, type Socket } from "socket.io-client";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3008";

export function createClassroomSocket(roomId: string, token: string): Socket {
  const socket = io(WS_URL, {
    auth: { token },
    query: { roomId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
}
