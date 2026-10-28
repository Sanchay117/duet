import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages are client-rendered from local state; API routes stream. Classic fetch caching
  // keeps Qloo responses in the private server-side data cache.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
