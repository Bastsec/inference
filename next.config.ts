/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add this line to enable standalone output
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;