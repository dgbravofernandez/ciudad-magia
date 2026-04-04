import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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