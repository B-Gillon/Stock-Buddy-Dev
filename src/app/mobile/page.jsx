// src/app/mobile/page.jsx
// Mobile dashboard — server component.
// Renders the MobileDashboard client component.

import MobileDashboard from "./components/MobileDashboard";

export const metadata = {
  title: "Stock Buddy — Mobile",
};

export default function MobilePage() {
  return <MobileDashboard />;
}
