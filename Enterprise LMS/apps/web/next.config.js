/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async rewrites() {
    return [
      // Auth Service :3001
      {
        source: "/api/auth/:path*",
        destination: "http://localhost:3001/api/auth/:path*",
      },
      // Learning Service :3002
      {
        source: "/api/learning/:path*",
        destination: "http://localhost:3002/api/:path*",
      },
      // AI Service :3003
      {
        source: "/api/ai/:path*",
        destination: "http://localhost:3003/api/ai/:path*",
      },
      // Analytics Service :3004
      {
        source: "/api/analytics/:path*",
        destination: "http://localhost:3004/api/analytics/:path*",
      },
      // Notification Service :3005
      {
        source: "/api/notifications/:path*",
        destination: "http://localhost:3005/api/notifications/:path*",
      },
      // Game Service :3006
      {
        source: "/api/game/:path*",
        destination: "http://localhost:3006/api/game/:path*",
      },
      // Media Service :3007
      {
        source: "/api/media/:path*",
        destination: "http://localhost:3007/api/v1/media/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
