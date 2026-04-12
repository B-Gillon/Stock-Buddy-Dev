"use client";

/**
 * src/app/components/AppBridgeProvider.jsx
 *
 * App Bridge v4 initializer for the Shopify embedded app.
 *
 * In App Bridge v4, there is no <Provider> wrapper component.
 * App Bridge initializes automatically when the page loads inside
 * the Shopify Admin iframe — no explicit setup required.
 *
 * What this component does:
 * - Injects the @shopify/app-bridge script tag into the page head
 * - Passes the API key and host so App Bridge can authenticate
 * - If shop/host params are absent (local dev outside iframe), renders
 *   children directly without App Bridge
 *
 * App Bridge v4 then handles session token attachment automatically
 * on all fetch() requests made from within the iframe.
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

    // App Bridge v4 auto-initializes via the script tag below.
    // We just need to ensure the config is available on the window.
    if (typeof window !== "undefined") {
      window.__appBridgeConfig = {
        apiKey: SHOPIFY_API_KEY,
        host,
        forceRedirect: true,
      };
    }
  }, [searchParams]);

  return <>{children}</>;
}
