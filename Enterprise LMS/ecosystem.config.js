"use strict";

const ROOT = __dirname;

/** @type {import('pm2').StartOptions[]} */
const services = [
  { name: "auth-service",         port: 3001, dir: "services/auth-service" },
  { name: "learning-service",     port: 3002, dir: "services/learning-service" },
  { name: "ai-service",           port: 3003, dir: "services/ai-service" },
  { name: "analytics-service",    port: 3004, dir: "services/analytics-service" },
  { name: "notification-service", port: 3005, dir: "services/notification-service" },
  { name: "game-service",         port: 3006, dir: "services/game-service" },
  { name: "media-service",        port: 3007, dir: "services/media-service" },
  { name: "realtime-gateway",     port: 3008, dir: "services/realtime-gateway" },
];

module.exports = {
  apps: [
    // ── Backend services ────────────────────────────────────
    ...services.map(({ name, port, dir }) => ({
      name,
      script: `${dir}/dist/index.js`,
      cwd: ROOT,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: port,
      },
      error_file: `logs/${name}-error.log`,
      out_file: `logs/${name}-out.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 5,
    })),

    // ── Next.js frontend ────────────────────────────────────
    {
      name: "web",
      script: "node_modules/.bin/next",
      args: "start --port 3000",
      cwd: `${ROOT}/apps/web`,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: `${ROOT}/logs/web-error.log`,
      out_file: `${ROOT}/logs/web-out.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 5,
    },
  ],
};
