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

  // Allow Shopify to embed this app in an iframe.
  // Content-Security-Policy frame-ancestors replaces the legacy X-Frame-Options header.
  // ngrok-skip-browser-warning bypasses the ngrok interstitial page in dev.
  // BEFORE GOING TO PRODUCTION:
  // - Remove ngrok-skip-browser-warning header
  // - Replace *.myshopify.com wildcard with specific shop domain if needed
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors",
              "https://*.myshopify.com",
              "https://admin.shopify.com",
            ].join(" "),
          },
          {
            // Bypasses the ngrok browser warning page in dev so the
            // Shopify Admin iframe can load the app without interruption.
            // Remove this header before going to production.
            key: "ngrok-skip-browser-warning",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
