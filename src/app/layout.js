/**
 * src/app/layout.js
 *
 * Root layout. Wraps every page in AppBridgeProvider so Shopify's
 * App Bridge is initialized for the embedded app context.
 *
 * The @shopify/app-bridge script tag is required for App Bridge v4
 * to initialize window.shopify in the iframe context.
 */

import { Suspense } from "react";
import "./globals.css";
import AppBridgeProvider from "./components/AppBridgeProvider";
import Script from "next/script";

export const metadata = {
  title: "Stock Buddy",
  description: "Inventory and product management for Shopify",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-gray-100">
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
