import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "https",
        hostname: "*.ondigitalocean.app",
      },
      {
        protocol: "https",
        hostname: "api.gtsplaner.app",
      },
    ],
  },
};

export default nextConfig;
