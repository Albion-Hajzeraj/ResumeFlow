/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // CI/typecheck is handled via `npm run typecheck`. This avoids Next spawning workers
    // in restricted environments where process spawning is blocked.
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['pdfjs-dist', 'tesseract.js'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        'tesseract.js': 'tesseract.js/dist/tesseract.min.js',
      };
    }
    return config;
  },
};

module.exports = nextConfig;
