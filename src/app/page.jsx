// src/app/page.jsx
// Root route.
// - If loaded inside Shopify (host + shop params present): redirect to /dashboard
// - Otherwise: redirect to /login (the proxy sends signed-in users to their own home)

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function RootPage({ searchParams }) {
  const params = await searchParams;
  const host = params.host;
  const shop = params.shop;

  // If Shopify params are present, we're inside the Admin iframe — go to dashboard
  if (host && shop) {
    // Keep every parameter Shopify sent (id_token, hmac, timestamp, ...): they are what proves the
    // store on the next request, so the app doesn't depend on third-party cookies.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      for (const val of Array.isArray(v) ? v : [v]) if (val != null) qs.append(k, String(val));
    }
    redirect(`/dashboard?${qs.toString()}`);
  }

  // Otherwise: the website. Signed-in users go to their home; everyone else to the login page.
  redirect("/login");
}
