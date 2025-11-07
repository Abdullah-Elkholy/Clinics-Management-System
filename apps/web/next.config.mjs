import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Help Next.js correctly infer the monorepo root to avoid ESLint/trace warnings
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
