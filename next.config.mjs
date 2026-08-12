/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow the LAN address to load dev resources (Next 16 blocks cross-origin dev
  // assets by default, which otherwise stops the client JS from hydrating when
  // you open the app via the network IP instead of localhost).
  allowedDevOrigins: ['172.16.144.172'],
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
