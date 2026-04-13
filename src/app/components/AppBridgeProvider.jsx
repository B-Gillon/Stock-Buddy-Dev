"use client";

/**
 * src/app/components/AppBridgeProvider.jsx
 *
 * App Bridge v4 initializer for the Shopify embedded app.
 *
 * On mount, if running inside the Shopify Admin iframe, uses
 * window.shopify.idToken() to get the App Bridge session token,
 * then calls the token exchange route to store a fresh offline
 * access token in the tenants table.
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

    // Set App Bridge config on window — no forceRedirect to avoid
    // postMessage origin mismatch errors in the iframe
    if (typeof window !== "undefined") {
      window.__appBridgeConfig = {
        apiKey: SHOPIFY_API_KEY,
        host,
      };
    }

    async function exchangeToken() {
      try {
        // Wait for App Bridge to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get session token from App Bridge v4
        const sessionToken = await window.shopify?.idToken();

        if (!sessionToken) {
          console.warn("[AppBridge] No session token available from window.shopify.idToken().");
          return;
        }

        console.log("[AppBridge] Got session token, exchanging...");

        const response = await fetch("/api/shopify/token-exchange", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
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
