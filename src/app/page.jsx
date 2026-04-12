/**
 * src/app/page.jsx
 *
 * Root route — redirects to the dashboard.
 * This is what Shopify loads when opening the embedded app.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
