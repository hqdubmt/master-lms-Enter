import type { WebSocket } from "@fastify/websocket";

export class RoomService {
  private rooms: Map<string, Set<WebSocket>>;

  constructor() {
    this.rooms = new Map();
  }

  join(roomId: string, socket: WebSocket): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(socket);
  }

  leave(roomId: string, socket: WebSocket): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.delete(socket);

    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  broadcast(roomId: string, message: object, exclude?: WebSocket): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(message);

    for (const socket of room) {
      if (socket === exclude) continue;
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  getRoomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  getRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}
