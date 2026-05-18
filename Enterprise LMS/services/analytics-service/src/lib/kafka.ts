import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});
