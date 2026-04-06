/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/s/files/**",
      },
    ],
  },

  // Prevent Next.js from bundling pdfkit — it must run as a native Node module
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
