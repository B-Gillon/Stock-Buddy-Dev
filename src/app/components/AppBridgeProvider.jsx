"use client";

/**
 * src/app/components/AppBridgeProvider.jsx
 *
 * App Bridge v4 initializer for the Shopify embedded app.
 *
 * On mount, if running inside the Shopify Admin iframe, calls the
 * token exchange route to ensure the tenant's access token is always
 * fresh in the database. This replaces the legacy OAuth callback flow.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

export default function AppBridgeProvider({ children }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const host = searchParams.get("host");

    if (!host || !SHOPIFY_API_KEY) {
      // Not running inside Shopify Admin iframe — skip App Bridge init
      return;
    }

    // Set App Bridge config on window for any App Bridge utilities that need it
    if (typeof window !== "undefined") {
      window.__appBridgeConfig = {
        apiKey: SHOPIFY_API_KEY,
        host,
        forceRedirect: true,
      };
    }

    // Exchange the App Bridge session token for an offline access token
    // and store it in the tenants table. This ensures sync operations
    // always have a valid token without requiring the legacy OAuth flow.
    async function exchangeToken() {
      try {
        // Wait briefly for App Bridge to initialize and attach its token
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Fetch a session token from App Bridge
        // App Bridge v4 attaches tokens automatically to fetch() calls
        // made within the iframe, so we make a fetch to our own route.
        const response = await fetch("/api/shopify/token-exchange", {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.warn("[AppBridge] Token exchange failed:", data.error);
        } else {
          console.log("[AppBridge] Token exchange successful.");
        }
      } catch (err) {
        console.warn("[AppBridge] Token exchange error:", err.message);
      }
    }

    exchangeToken();
  }, [searchParams]);

  return <>{children}</>;
}
