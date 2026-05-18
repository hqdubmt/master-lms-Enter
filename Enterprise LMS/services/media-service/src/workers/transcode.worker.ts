import path from "path";
import fs from "fs";
import os from "os";
import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { transcodeToHls, uploadHls } from "../services/transcode.service.js";

export interface TranscodeJobData {
  inputPath: string;
  jobId: string;
  schoolId: number;
}

export interface TranscodeJobResult {
  playlistUrl: string;
  jobId: string;
}

async function processTranscodeJob(
  job: Job<TranscodeJobData, TranscodeJobResult>
): Promise<TranscodeJobResult> {
  const { inputPath, jobId } = job.data;

  const outputDir = path.join(os.tmpdir(), "lms-hls", jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    await job.updateProgress(0);

    // Transcode to HLS
    await transcodeToHls(inputPath, outputDir, jobId);
    await job.updateProgress(50);

    // Upload HLS files to MinIO
    const playlistUrl = await uploadHls(jobId, outputDir);
    await job.updateProgress(100);

    return { playlistUrl, jobId };
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
      if (fs.existsSync(inputPath)) {
        fs.rmSync(inputPath, { force: true });
      }
    } catch (cleanupErr) {
      console.warn(`[transcode-worker] Cleanup failed for job ${jobId}:`, cleanupErr);
    }
  }
}

export function createTranscodeWorker(): Worker<TranscodeJobData, TranscodeJobResult> {
  const worker = new Worker<TranscodeJobData, TranscodeJobResult>(
    "transcode-jobs",
    processTranscodeJob,
    {
      connection: redis,
      concurrency: 2,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );

  worker.on("active", (job) => {
    console.log(`[transcode-worker] Job ${job.id} started (jobId: ${job.data.jobId})`);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[transcode-worker] Job ${job.id} progress: ${progress}%`);
  });

  worker.on("completed", (job) => {
    console.log(`[transcode-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[transcode-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
