/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the build produces .next/standalone with the correct server entrypoints
  output: 'standalone',
  experimental: {
    // Workaround for Next 15 clientReferenceManifest invariant under some builds
    ppr: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
