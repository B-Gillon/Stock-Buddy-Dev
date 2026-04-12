"use client";

/**
 * src/app/components/AppBridgeProvider.jsx
 *
 * Initializes Shopify App Bridge inside the embedded app iframe.
 *
 * App Bridge reads the `shop` and `host` params from the URL, which
 * Shopify automatically appends when loading your app in the Admin.
 * Once initialized, App Bridge silently attaches a fresh session token
 * (JWT) to every fetch() request the frontend makes to your backend.
 *
 * This component must be a client component — App Bridge uses browser
 * APIs and reads from window.location.
 *
 * Usage: wrap the app shell in layout.js with this provider.
 */

import { useEffect, useState } from "react";
import { Provider } from "@shopify/app-bridge-react";
import { useSearchParams } from "next/navigation";

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

export default function AppBridgeProvider({ children }) {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const shop = searchParams.get("shop");
    const host = searchParams.get("host");

    // Both shop and host are required for App Bridge to initialize.
    // In local dev without the Shopify iframe, these won't be present —
    // the dev fallback in sessionToken.js and tenants.js handles that case.
    if (!shop || !host) {
      return;
    }

    setConfig({
      apiKey: SHOPIFY_API_KEY,
      host,
      forceRedirect: true,
    });
  }, [searchParams]);

  // If we don't have a config (e.g. local dev outside Shopify iframe),
  // render children directly without App Bridge wrapping.
  if (!config) {
    return <>{children}</>;
  }

  return <Provider config={config}>{children}</Provider>;
}
