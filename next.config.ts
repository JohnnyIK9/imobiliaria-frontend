import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8080'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.165'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ]
  },
}

export default nextConfig;
