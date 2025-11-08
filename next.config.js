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
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react'],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Enable static optimization for all pages
  output: 'standalone',
  // Disable TypeScript type checking during build for faster builds
  typescript: {
    ignoreBuildErrors: false,
  },
  // Disable ESLint during build for faster builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Improve image optimization
  images: {
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.js',
  },
};

module.exports = nextConfig;
