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
import "./globals.css";
import AppBridgeProvider from "./components/AppBridgeProvider";

export const metadata = {
  title: "Stock Buddy",
  description: "Inventory and product management for Shopify",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
