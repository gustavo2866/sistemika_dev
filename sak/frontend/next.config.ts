import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita warnings por lockfiles en la raíz del monorepo
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
