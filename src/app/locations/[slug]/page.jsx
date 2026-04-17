// /src/app/locations/[slug]/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { notFound } from "next/navigation";
import ClientLocationDetailPage from "./components/ClientLocationDetailPage";

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }) {
  const { slug } = await params;

  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: locations } = await supabase
    .from("locations")
    .select("id, shopify_location_id, name, active, location_type, address1, address2, city, province, country, zip, connected_to, inventory_controlled_by, provides_tracking, sku_sharing_allowed, orders_api_type, created_at, updated_at")
    .eq("tenant_id", tenantId);

  const location = (locations ?? []).find((l) => toSlug(l.name) === slug);
  if (!location) notFound();

  const [inventoryRes, contactsRes, syncRes] = await Promise.all([
    supabase
      .from("inventory_levels")
      .select("available")
      .eq("tenant_id", tenantId)
      .eq("location_id", location.id),
    supabase
      .from("location_contacts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("location_id", location.id)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("tenant_id", tenantId)
      .eq("sync_type", "locations")
      .maybeSingle(),
  ]);

  const levels           = inventoryRes.data ?? [];
  const total_inventory  = levels.reduce((sum, l) => sum + (l.available ?? 0), 0);
  const total_item_count = levels.length;
  const in_stock_count   = levels.filter((l) => (l.available ?? 0) > 0).length;

  return (
    <ClientLocationDetailPage
      location={{ ...location, total_inventory, total_item_count, in_stock_count }}
      initialContacts={contactsRes.data ?? []}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
      slug={slug}
    />
  );
}
