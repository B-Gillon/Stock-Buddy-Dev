// src/app/page.jsx
// Root route.
// - If loaded inside Shopify (host + shop params present): redirect to /dashboard
// - Otherwise: redirect to /request-access (public landing page)

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function RootPage({ searchParams }) {
  const params = await searchParams;
  const host = params.host;
  const shop = params.shop;

  // If Shopify params are present, we're inside the Admin iframe — go to dashboard
  if (host && shop) {
    redirect(`/dashboard?shop=${shop}&host=${host}`);
  }

  // Otherwise send to the request-access intro page
  redirect("/request-access");
}
