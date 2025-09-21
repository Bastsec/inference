import type { NextConfig } from 'next';

// Disable experimental flags to avoid canary runtime manifest bugs under Bun
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
