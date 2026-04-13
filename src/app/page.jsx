// src/app/page.jsx
// Root landing page — shown when the app is accessed outside of Shopify Admin.
// Collects the merchant's shop domain and redirects to the OAuth install flow.

export const dynamic = "force-dynamic";

import InstallPage from "./components/InstallPage";

export default function RootPage({ searchParams }) {
  return <InstallPage />;
}
