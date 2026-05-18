import path from "path";
import fs from "fs";
import { createReadStream } from "fs";
import ffmpeg from "fluent-ffmpeg";
import { minioClient, BUCKET } from "../lib/minio.js";

export interface HlsResult {
  playlist: string;
  segments: string[];
}

export function transcodeToHls(
  inputPath: string,
  outputDir: string,
  jobId: string
): Promise<HlsResult> {
  return new Promise((resolve, reject) => {
    const playlistName = `${jobId}.m3u8`;
    const playlistPath = path.join(outputDir, playlistName);
    const segmentPattern = path.join(outputDir, `${jobId}_%03d.ts`);

    ffmpeg(inputPath)
      .outputOptions([
        "-codec:v libx264",
        "-crf 23",
        "-preset fast",
        "-codec:a aac",
        "-b:a 128k",
        "-hls_time 6",
        "-hls_list_size 0",
        "-hls_segment_filename",
        segmentPattern,
        "-f hls",
      ])
      .output(playlistPath)
      .on("start", (cmd) => {
        console.log(`[transcode] ffmpeg started: ${cmd}`);
      })
      .on("progress", (progress) => {
        console.log(
          `[transcode] Job ${jobId} progress: ${Math.round(progress.percent ?? 0)}%`
        );
      })
      .on("end", () => {
        const segments = fs
          .readdirSync(outputDir)
          .filter((f) => f.endsWith(".ts"))
          .map((f) => path.join(outputDir, f));

        resolve({ playlist: playlistPath, segments });
      })
      .on("error", (err) => {
        console.error(`[transcode] Job ${jobId} failed:`, err.message);
        reject(err);
      })
      .run();
  });
}

export async function uploadHls(
  jobId: string,
  outputDir: string
): Promise<string> {
  const files = fs.readdirSync(outputDir);

  const uploadPromises = files.map(async (filename) => {
    const filePath = path.join(outputDir, filename);
    const key = `hls/${jobId}/${filename}`;
    const stat = fs.statSync(filePath);

    const mimetype = filename.endsWith(".m3u8")
      ? "application/x-mpegURL"
      : "video/MP2T";

    const stream = createReadStream(filePath);
    await minioClient.putObject(BUCKET, key, stream, stat.size, {
      "Content-Type": mimetype,
    });
  });

  await Promise.all(uploadPromises);

  const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = process.env.MINIO_PORT ?? "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";

  return `${protocol}://${endpoint}:${port}/${BUCKET}/hls/${jobId}/${jobId}.m3u8`;
}
