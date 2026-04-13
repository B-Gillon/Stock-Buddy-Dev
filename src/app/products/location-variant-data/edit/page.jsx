// /src/app/products/location-variant-data/edit/page.jsx

import { headers } from "next/headers";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import ClientLocationVariantEditPage from "./components/ClientLocationVariantEditPage";

export const dynamic = "force-dynamic";

export default async function LocationVariantDataEditPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  const [locationsRes, variantsRes] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("name", { ascending: true }),

    supabase
      .from("variants")
      .select(`
        id,
        sku,
        barcode,
        display_title,
        products (
          title,
          category,
          collection
        )
      `)
      .eq("tenant_id", tenantId)
      .order("display_title", { ascending: true })
      .limit(2000),
  ]);

  const locations = locationsRes.data ?? [];
  const variants  = variantsRes.data ?? [];

  // Load all bin records for this tenant so we can left-join in memory
  const { data: bins } = await supabase
    .from("variant_location_bins")
    .select("variant_id, location_id, bin_location, updated_at")
    .eq("tenant_id", tenantId);

  // Build a lookup: "variantId|locationId" → bin row
  const binMap = {};
  (bins ?? []).forEach((b) => {
    binMap[`${b.variant_id}|${b.location_id}`] = b;
  });

  // Produce one row per variant × location combination.
  // The client will filter down to the selected location after Submit.
  const rows = [];
  for (const v of variants) {
    for (const loc of locations) {
      const bin = binMap[`${v.id}|${loc.id}`] ?? null;
      rows.push({
        // Synthetic key used for edit state — no bin record needed
        id:                 `${v.id}|${loc.id}`,
        variant_id:         v.id,
        location_id:        loc.id,
        bin_location:       bin?.bin_location ?? "",
        updated_at:         bin?.updated_at ?? null,
        variant_sku:        v.sku ?? null,
        variant_barcode:    v.barcode ?? null,
        variant_title:      v.display_title ?? null,
        product_title:      v.products?.title ?? null,
        product_category:   v.products?.category ?? null,
        product_collection: v.products?.collection ?? null,
      });
    }
  }

  const categories = Array.from(
    new Set(rows.map((r) => r.product_category).filter(Boolean))
  ).sort();

  const collections = Array.from(
    new Set(rows.map((r) => r.product_collection).filter(Boolean))
  ).sort();

  return (
    <ClientLocationVariantEditPage
      locations={locations}
      initialRows={rows}
      categories={categories}
      collections={collections}
    />
  );
}

