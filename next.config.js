/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['jwnfltfrzkujvlzwkwff.supabase.co'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    loader: 'default',
  },
  experimental: {
    // Disable optimizeCss as it's causing issues with critters
    // optimizeCss: true,
    optimizePackageImports: ['lucide-react'],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Use static export for Vercel
  output: 'export',
  // Add trailing slash for static export
  trailingSlash: true,
  // Disable TypeScript type checking during build for faster builds
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build for faster builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable image optimization API as we're using static export
  images: {
    unoptimized: true,
  },
  // Add webpack configuration
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
