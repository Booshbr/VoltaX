/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev-only: allow specific LAN origins to load dev assets (Next 16 blocks
  // cross-origin dev resources by default). Set VOLTAX_DEV_ORIGINS to a
  // comma-separated list to open the dev server from other devices; harmless in
  // production. Defaults cover localhost access with no config.
  allowedDevOrigins: (process.env.VOLTAX_DEV_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Security headers applied to every response. See docs/SECURITY.md.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
