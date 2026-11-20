"use client";

/**
 * src/app/components/AppBridgeProvider.jsx
 *
 * App Bridge v4 initializer for the Shopify embedded app.
 *
 * On mount, decodes the `host` param (base64 encoded shop domain)
 * and calls /api/shopify/set-shop-cookie to set the sb-shop cookie
 * server-side. This ensures every subsequent request from this session
 * resolves to the correct tenant regardless of whether ?shop appears
 * in the URL.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

/**
 * Session-token fetch. Inside the Shopify admin, every request to this app sends a fresh
 * Shopify session token (Authorization: Bearer ...), so the store is proven by Shopify on each
 * request and nothing depends on third-party cookies. Only when running inside the Shopify iframe;
 * on the website (login pages, supplier portal) fetch is left alone.
 */
if (typeof window !== "undefined" && !window.__sbFetchPatched) {
  window.__sbFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);

  const sameOrigin = (input) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

  window.fetch = async (input, init) => {
    try {
      if (window.self !== window.top && window.shopify?.idToken && sameOrigin(input)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("Authorization")) {
          const token = await withTimeout(window.shopify.idToken(), 4000);
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
            return nativeFetch(input, { ...init, headers });
          }
        }
      }
    } catch {
      // fall through to a plain request
    }
    return nativeFetch(input, init);
  };
}

/**
 * Decode the Shopify `host` param to extract the shop domain.
 *
 * Shopify sends host as base64-encoded in one of two formats:
 *   - "admin.shopify.com/store/{handle}" (newer format)
 *   - "{shop}.myshopify.com/admin"       (older format)
 *
 * We handle both and always return a bare myshopify.com domain.
 */

export default function AppBridgeProvider({ children }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const host = searchParams.get("host");

    if (!host || !SHOPIFY_API_KEY) {
      return;
    }

    // Set App Bridge config on window
    if (typeof window !== "undefined") {
      window.__appBridgeConfig = {
        apiKey: SHOPIFY_API_KEY,
        host,
      };
    }

    // Attempt token exchange (non-blocking)
    async function exchangeToken() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const sessionToken = await window.shopify?.idToken();

        if (!sessionToken) {
          console.warn("[AppBridge] No session token available from window.shopify.idToken().");
          return;
        }

        // Ask the server to remember this verified store (signed cookie)
        await fetch("/api/shopify/set-shop-cookie", {
          method:  "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        }).catch((err) => console.warn("[AppBridge] Failed to set shop cookie:", err.message));

        const response = await fetch("/api/shopify/token-exchange", {
          method:  "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
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
