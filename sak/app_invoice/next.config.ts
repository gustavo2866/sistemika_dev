import type { NextConfig } from "next";

const nextConfig = {
  // Silence Turbopack workspace-root warning by pinning the root to this app
  turbopack: {
    root: __dirname,
  },
  eslint: {
    // Temporarily ignore ESLint errors during builds; lint can be run separately
    ignoreDuringBuilds: true,
  },
  // Proxy API requests to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
} satisfies NextConfig & { turbopack?: { root?: string } };

export default nextConfig;
