/**
 * src/app/layout.js
 *
 * Root layout. Wraps every page in AppBridgeProvider so Shopify's
 * App Bridge is initialized for the embedded app context.
 *
 * AppBridgeProvider is a client component — it must be wrapped in
 * Suspense because it uses useSearchParams() which requires it.
 */

import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import AppBridgeProvider from "./components/AppBridgeProvider";

const GA_ID = "G-92VPVTJDC4";

export const metadata = {
  title: "Stock Buddy",
  description: "Inventory and product management for Shopify",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Shopify App Bridge: must be a plain, synchronous script in <head>, with the
            api-key meta tag. Provides window.shopify (session tokens, user identity). */}
        <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      </head>
      <body className="bg-gray-100">

        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>

        <div id="app-root" className="min-h-screen flex flex-col">
          <Suspense fallback={null}>
            <AppBridgeProvider>
              {children}
            </AppBridgeProvider>
          </Suspense>
        </div>

      </body>
    </html>
  );
}
