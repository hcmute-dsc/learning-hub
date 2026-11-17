import { fileURLToPath } from 'node:url';

// Read at BUILD time (rewrites are compiled into the build): the Docker image is built
// with API_INTERNAL_URL=http://api:4000, the service name in deploy/docker-compose.prod.yml.
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker image (apps/web/Dockerfile): a self-contained server.js with only the files it needs.
  output: 'standalone',
  // Monorepo: trace files from the repo root so @hub/shared is included.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  poweredByHeader: false,
  transpilePackages: ['@hub/shared'],
  // Same-origin API: the browser only talks to the web origin, so session cookies
  // can be `__Host-` + SameSite=Lax in production (ARCHITECTURE §6).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'avatars.githubusercontent.com' }] },
};

export default nextConfig;
