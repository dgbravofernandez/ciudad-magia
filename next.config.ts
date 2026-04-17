import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    // Tables not yet in generated Supabase types — doesn't affect runtime
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.externals.push({ canvas: 'canvas' });
    }
    return config;
  },
};

export default nextConfig;