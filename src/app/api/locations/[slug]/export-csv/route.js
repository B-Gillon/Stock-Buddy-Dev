// /src/app/api/locations/[slug]/export-csv/route.js
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

/**
 * GET /api/locations/[slug]/export-csv
 * Exports ALL variants stocked at a location as a CSV in the import format.
 * Uses inventory_levels to find every variant at this location, then
 * joins variant_location_bins to include any existing bin location values.
 * Variants with no bin location set will have an empty Bin Location column.
 *
 * CSV columns (matching the import format exactly):
 * Variant ID, SKU, Bin Location
 */
export async function GET(request, { params }) {
  let tenantId;
  try {
    tenantId = await getTenantId(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug: locationId } = await params;

  // Fetch location name for the filename
  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .eq("tenant_id", tenantId)
    .single();

  // Step 1: Get all inventory_items that have a level at this location,
  // joined to their variant for shopify_variant_id and sku.
  const { data: levels, error: levelsError } = await supabase
    .from("inventory_levels")
    .select(`
      inventory_items (
        variant_id,
        variants (
          id,
          shopify_variant_id,
          sku
        )
      )
    `)
    .eq("location_id", locationId)
    .eq("tenant_id", tenantId);

  if (levelsError) {
    console.error("export-csv levels error:", levelsError);
    return NextResponse.json({ error: levelsError.message }, { status: 500 });
  }

  // Flatten to unique variants (dedupe by variant id in case of multiple levels)
  const variantMap = new Map();
  for (const level of levels ?? []) {
    const v = level.inventory_items?.variants;
    if (!v) continue;
    if (!variantMap.has(v.id)) {
      variantMap.set(v.id, {
        id:                 v.id,
        shopify_variant_id: v.shopify_variant_id,
        sku:                v.sku,
      });
    }
  }

  const variantIds = Array.from(variantMap.keys());

  // Step 2: Fetch existing bin locations for these variants at this location
  const binMap = new Map(); // variant_id → bin_location
  if (variantIds.length > 0) {
    const { data: bins } = await supabase
      .from("variant_location_bins")
      .select("variant_id, bin_location")
      .eq("location_id", locationId)
      .eq("tenant_id", tenantId)
      .in("variant_id", variantIds);

    for (const bin of bins ?? []) {
      binMap.set(bin.variant_id, bin.bin_location ?? "");
    }
  }

  // Step 3: Build CSV
  function escapeCSV(value) {
    if (value == null || value === "") return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = ["Variant ID", "SKU", "Bin Location"];

  // Sort by SKU for a predictable, user-friendly order
  const variants = Array.from(variantMap.values()).sort((a, b) =>
    (a.sku ?? "").localeCompare(b.sku ?? "")
  );

  const rows = variants.map((v) => [
    // Quote Variant ID to prevent scientific notation in Excel
    v.shopify_variant_id ? `"${v.shopify_variant_id}"` : "",
    escapeCSV(v.sku),
    escapeCSV(binMap.get(v.id) ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");

  const locationSlug = (location?.name ?? "location")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${locationSlug}-bin-locations.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
