import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  webpack: (config) => {
    // The shared ../src lib uses NodeNext-style ".js" extensions on relative
    // imports of .ts files (required for the CLI's plain Node ESM runtime).
    // Teach webpack to resolve those the same way tsc/tsx already do.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
