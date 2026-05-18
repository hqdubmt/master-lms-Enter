import IORedis from "ioredis";

export class PubSubService {
  private pub: IORedis;
  private sub: IORedis;
  private handlers: Map<string, Set<(data: object) => void>>;

  constructor() {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.pub = new IORedis(url, { maxRetriesPerRequest: null });
    this.sub = new IORedis(url, { maxRetriesPerRequest: null });
    this.handlers = new Map();

    this.sub.on("message", (channel: string, raw: string) => {
      const set = this.handlers.get(channel);
      if (!set || set.size === 0) return;

      let data: object;
      try {
        data = JSON.parse(raw) as object;
      } catch {
        console.error(`[PubSubService] Failed to parse message on ${channel}:`, raw);
        return;
      }

      for (const handler of set) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[PubSubService] Handler error on ${channel}:`, err);
        }
      }
    });

    this.sub.on("error", (err) => {
      console.error("[PubSubService] Redis sub error:", err);
    });

    this.pub.on("error", (err) => {
      console.error("[PubSubService] Redis pub error:", err);
    });
  }

  async publish(channel: string, data: object): Promise<void> {
    await this.pub.publish(channel, JSON.stringify(data));
  }

  subscribe(channel: string, handler: (data: object) => void): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      // Subscribe to Redis channel when the first handler is added
      this.sub.subscribe(channel).catch((err) => {
        console.error(`[PubSubService] Failed to subscribe to ${channel}:`, err);
      });
    }

    this.handlers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: (data: object) => void): void {
    const set = this.handlers.get(channel);
    if (!set) return;

    set.delete(handler);

    if (set.size === 0) {
      this.handlers.delete(channel);
      this.sub.unsubscribe(channel).catch((err) => {
        console.error(`[PubSubService] Failed to unsubscribe from ${channel}:`, err);
      });
    }
  }

  async quit(): Promise<void> {
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }
}
