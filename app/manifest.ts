import type { MetadataRoute } from 'next';

/** PWA manifest (served at /manifest.webmanifest) so VoltaX is installable on a
 * phone home screen — a prerequisite for Web Push on iOS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VoltaX — Trading Intelligence',
    short_name: 'VoltaX',
    description: 'Statistical trading analysis and alerts for Deriv synthetic indices.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d1117',
    theme_color: '#0d1117',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
