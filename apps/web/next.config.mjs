import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Disable ESLint errors during build (warnings only)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimize webpack configuration for better chunk loading
  webpack: (config, { isServer, dev }) => {
    if (!isServer && dev) {
      // In development, improve chunk loading reliability
      // Keep default Next.js chunking strategy but ensure proper error handling
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
      };
    }
    return config;
  },

  // Increase timeout for chunk loading in development
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 60 * 1000,
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 5,
    },
  }),
};

export default nextConfig;
