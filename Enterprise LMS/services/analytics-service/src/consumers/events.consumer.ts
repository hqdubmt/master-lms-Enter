import type { AppEvent } from "@lms/types";
import { kafka } from "../lib/kafka.js";
import { clickhouse } from "../lib/clickhouse.js";
import { trackEvent } from "../services/analytics.service.js";

const TOPIC = "lms-events";
const GROUP_ID = "analytics-group";

async function initClickHouseTable(): Promise<void> {
  await clickhouse.command({
    query: `
      CREATE TABLE IF NOT EXISTS lms_events (
        event_id     String,
        event_type   LowCardinality(String),
        school_id    Int32,
        user_id      Int32,
        course_id    Int32,
        lesson_id    String DEFAULT '',
        quiz_id      String DEFAULT '',
        score        Float64 DEFAULT 0,
        max_score    Float64 DEFAULT 0,
        duration_ms  Int64 DEFAULT 0,
        occurred_at  DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(occurred_at)
      ORDER BY (school_id, user_id, occurred_at)
    `,
  });
}

export async function startEventsConsumer(): Promise<void> {
  await initClickHouseTable();

  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: AppEvent;
      try {
        event = JSON.parse(message.value.toString()) as AppEvent;
      } catch (err) {
        console.error("[analytics-consumer] Failed to parse event:", err);
        return;
      }

      try {
        await trackEvent(event);
      } catch (err) {
        console.error("[analytics-consumer] Failed to track event:", err);
      }
    },
  });

  const shutdown = async () => {
    await consumer.disconnect();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
