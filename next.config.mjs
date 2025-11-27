/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
