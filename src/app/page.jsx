// src/app/page.jsx
// Root route.
// - If loaded inside Shopify (host + shop params present): redirect to /dashboard
// - Otherwise: show the install landing page for new merchants

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import InstallPage from "./components/InstallPage";

export default async function RootPage({ searchParams }) {
  const params = await searchParams;
  const host = params.host;
  const shop = params.shop;

  // If Shopify params are present, we're inside the Admin iframe — go to dashboard
  if (host && shop) {
    redirect(`/dashboard?shop=${shop}&host=${host}`);
  }

  // Otherwise show the install landing page
  return <InstallPage />;
}
