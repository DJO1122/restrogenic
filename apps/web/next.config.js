/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // TypeScript build checks are ON — `tsc --noEmit` passes clean.
  typescript: { ignoreBuildErrors: false },
  // ESLint isn't configured in this repo yet; don't block builds on it.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
