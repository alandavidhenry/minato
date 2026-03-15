/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    unoptimized: true
  },
  webpack: (config) => {
    // Add canvas mock for pdf.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false
    };
    return config;
  }
};

export default nextConfig;