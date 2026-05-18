import path from "path";
import fs from "fs";
import os from "os";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { ok, fail } from "@lms/utils";
import { requireAuth } from "../middleware/requireAuth.js";
import { redis } from "../lib/redis.js";
import {
  upload,
  deleteObject,
  presignedUrl,
} from "../services/storage.service.js";
import type { TranscodeJobData, TranscodeJobResult } from "../workers/transcode.worker.js";

const transcodeQueue = new Queue<TranscodeJobData, TranscodeJobResult>(
  "transcode-jobs",
  { connection: redis }
);

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // POST /upload — multipart: upload file to MinIO, return { url, key }
  app.post(
    "/upload",
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send(fail("No file provided"));
      }

      const ext = path.extname(data.filename) || "";
      const key = `uploads/${request.user.schoolId}/${randomUUID()}${ext}`;

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk as Buffer);
        }
        const buffer = Buffer.concat(chunks);

        const { Readable } = await import("stream");
        const stream = Readable.from(buffer);

        const url = await upload(key, stream, buffer.length, data.mimetype);

        return reply.send(ok({ url, key }));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to upload file"));
      }
    }
  );

  // POST /video — multipart: save to temp dir, enqueue transcode job
  app.post(
    "/video",
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send(fail("No video file provided"));
      }

      const jobId = randomUUID();
      const tmpDir = path.join(os.tmpdir(), "lms-uploads");
      fs.mkdirSync(tmpDir, { recursive: true });

      const ext = path.extname(data.filename) || ".mp4";
      const inputPath = path.join(tmpDir, `${jobId}${ext}`);

      try {
        await pipeline(data.file, createWriteStream(inputPath));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to save video file"));
      }

      try {
        await transcodeQueue.add(
          "transcode",
          {
            inputPath,
            jobId,
            schoolId: request.user.schoolId,
          },
          { jobId }
        );

        return reply.code(202).send(ok({ jobId }, "Video queued for transcoding"));
      } catch (err) {
        // Cleanup temp file on queue error
        fs.rmSync(inputPath, { force: true });
        app.log.error(err);
        return reply.code(500).send(fail("Failed to queue transcode job"));
      }
    }
  );

  // GET /video/:jobId/status — BullMQ job state + progress
  app.get<{ Params: { jobId: string } }>(
    "/video/:jobId/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params;

      try {
        const job = await transcodeQueue.getJob(jobId);

        if (!job) {
          return reply.code(404).send(fail("Job not found"));
        }

        const state = await job.getState();
        const progress = job.progress;

        return reply.send(
          ok({
            jobId,
            state,
            progress,
            failedReason: job.failedReason ?? null,
          })
        );
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch job status"));
      }
    }
  );

  // GET /video/:jobId/url — HLS playlist URL when done
  app.get<{ Params: { jobId: string } }>(
    "/video/:jobId/url",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params;

      try {
        const job = await transcodeQueue.getJob(jobId);

        if (!job) {
          return reply.code(404).send(fail("Job not found"));
        }

        const state = await job.getState();

        if (state !== "completed") {
          return reply.code(202).send(
            ok({ jobId, state }, `Job is not complete yet (state: ${state})`)
          );
        }

        const result = job.returnvalue as TranscodeJobResult;
        return reply.send(ok({ jobId, playlistUrl: result.playlistUrl }));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to fetch video URL"));
      }
    }
  );

  // DELETE /:key — delete from MinIO
  app.delete<{ Params: { "*": string } }>(
    "/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const key = request.params["*"];

      if (!key) {
        return reply.code(400).send(fail("Key is required"));
      }

      try {
        await deleteObject(key);
        return reply.send(ok(null, "File deleted"));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to delete file"));
      }
    }
  );

  // GET /presign/:key — get presigned URL (bonus utility)
  app.get<{ Params: { "*": string }; Querystring: { expiry?: string } }>(
    "/presign/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const key = request.params["*"];
      const expiry = parseInt(request.query.expiry ?? "3600", 10);

      if (!key) {
        return reply.code(400).send(fail("Key is required"));
      }

      try {
        const url = await presignedUrl(key, expiry);
        return reply.send(ok({ url, expiresIn: expiry }));
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send(fail("Failed to generate presigned URL"));
      }
    }
  );
}
