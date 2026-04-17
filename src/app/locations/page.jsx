// /src/app/locations/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientLocationsPage from "@/app/locations/components/ClientLocationsPage";

export const dynamic = "force-dynamic";

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default async function LocationsPage() {
  const headersList = await headers();
  const tenantId    = await getTenantIdFromHeaders(headersList);

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, active, address1, city, province, zip, country")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const { data: primaryContacts } = await supabase
    .from("location_contacts")
    .select("location_id, name, phone, email, role")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true);

  const primaryByLocation = new Map(
    (primaryContacts ?? []).map((c) => [c.location_id, c])
  );

  const { data: syncStatus } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("sync_type", "locations")
    .maybeSingle();

  const enrichedLocations = (locations ?? []).map((location) => {
    const primary = primaryByLocation.get(location.id);
    return {
      ...location,
      slug:          toSlug(location.name),
      primary_name:  primary?.name  ?? null,
      primary_role:  primary?.role  ?? null,
      primary_phone: primary?.phone ?? null,
      primary_email: primary?.email ?? null,
    };
  });

  return (
    <ClientLocationsPage
      locations={enrichedLocations}
      lastSyncedAt={syncStatus?.last_synced_at ?? null}
    />
  );
}
