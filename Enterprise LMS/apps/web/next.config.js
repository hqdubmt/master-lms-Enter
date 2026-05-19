/** @type {import('next').NextConfig} */

const AUTH_URL        = process.env.AUTH_SERVICE_URL        || "http://localhost:3001";
const LEARNING_URL    = process.env.LEARNING_SERVICE_URL    || "http://localhost:3002";
const AI_URL          = process.env.AI_SERVICE_URL          || "http://localhost:3003";
const ANALYTICS_URL   = process.env.ANALYTICS_SERVICE_URL  || "http://localhost:3004";
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3005";
const GAME_URL        = process.env.GAME_SERVICE_URL        || "http://localhost:3006";
const MEDIA_URL       = process.env.MEDIA_SERVICE_URL       || "http://localhost:3007";

const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "minio" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/auth/:path*",          destination: `${AUTH_URL}/api/auth/:path*` },
      { source: "/api/users/:path*",         destination: `${AUTH_URL}/api/users/:path*` },
      { source: "/api/learning/:path*",      destination: `${LEARNING_URL}/api/:path*` },
      { source: "/api/ai/:path*",            destination: `${AI_URL}/api/ai/:path*` },
      { source: "/api/analytics/:path*",     destination: `${ANALYTICS_URL}/api/analytics/:path*` },
      { source: "/api/notifications/:path*", destination: `${NOTIFICATION_URL}/api/notifications/:path*` },
      { source: "/api/game/:path*",          destination: `${GAME_URL}/api/game/:path*` },
      { source: "/api/media/:path*",         destination: `${MEDIA_URL}/api/v1/media/:path*` },
    ];
  },
};

module.exports = nextConfig;
