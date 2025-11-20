import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration for file uploads and API routes
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle pdfjs-dist for server-side
      config.externals = [...(config.externals || []), 'canvas', 'canvas-prebuilt'];
    }
    return config;
  },
};

export default nextConfig;
