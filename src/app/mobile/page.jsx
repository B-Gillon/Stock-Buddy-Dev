// src/app/mobile/page.jsx
// Mobile dashboard — server component.
// force-dynamic required so the sb-shop cookie is always read fresh
// and tenant context is resolved on every request.

export const dynamic = "force-dynamic";

import MobileDashboard from "./components/MobileDashboard";

export const metadata = {
  title: "Stock Buddy — Mobile",
};

export default function MobilePage() {
  return <MobileDashboard />;
}
