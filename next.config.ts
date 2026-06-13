import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Redirige TODOS los dominios antiguos al definitivo cluberly.club (301).
      // Este nivel se ejecuta en CDN antes que cualquier código.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'ciudad-magia-qj91.vercel.app' }],
        destination: 'https://cluberly.club/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'cluberly.vercel.app' }],
        destination: 'https://cluberly.club/:path*',
        permanent: true,
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    // Allow logos / media served from Supabase Storage (any project) and
    // common avatar/CDN hosts used in the app.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Allow server actions up to 30s (PDF generation + email)
  serverExternalPackages: ['@react-pdf/renderer'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.externals.push({ canvas: 'canvas' });
    }
    return config;
  },
};

// Sentry: activar wrapping solo si NEXT_PUBLIC_SENTRY_DSN está configurado.
// Para activar: añadir NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT,
// SENTRY_AUTH_TOKEN en las variables de entorno de Vercel.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const finalConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? require('@sentry/nextjs').withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      hideSourceMaps: true,
    })
  : nextConfig

export default finalConfig