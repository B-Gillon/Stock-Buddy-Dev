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
    redirect(`/dashboard?shop=${shop}&host=${host}`);
  }

  // Otherwise: the website. Signed-in users go to their home; everyone else to the login page.
  redirect("/login");
}
