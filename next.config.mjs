/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true
  },
  turbopack: {
    resolveAlias: {
      // Prevent canvas from being bundled (pdf.js compatibility)
      canvas: './src/lib/empty-module.js'
    }
  }
};

export default nextConfig;