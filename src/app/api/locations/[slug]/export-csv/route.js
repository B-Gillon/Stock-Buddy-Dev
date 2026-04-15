// /src/app/api/locations/[slug]/export-csv/route.js
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

/**
 * GET /api/locations/[slug]/export-csv
 * Exports ALL variants for this tenant as a CSV in the import format,
 * pre-filled with any existing bin location values for this location.
 * Variants with no bin location set will have an empty Bin Location column.
 *
 * CSV columns (matching the import format exactly):
 * Variant ID, SKU, Barcode, Display Title, Bin Location
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

  // Step 1: Fetch ALL variants for this tenant
  const { data: variants, error: variantsError } = await supabase
    .from("variants")
    .select("id, shopify_variant_id, sku, barcode, display_title")
    .eq("tenant_id", tenantId)
    .order("display_title", { ascending: true });

  if (variantsError) {
    console.error("export-csv variants error:", variantsError);
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  const variantIds = (variants ?? []).map((v) => v.id);

  // Step 2: Fetch existing bin locations for this location
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

  const headers = ["Variant ID", "SKU", "Barcode", "Display Title", "Bin Location"];

  const rows = (variants ?? []).map((v) => [
    // Quote Variant ID to prevent scientific notation in Excel
    v.shopify_variant_id ? `"${v.shopify_variant_id}"` : "",
    escapeCSV(v.sku),
    escapeCSV(v.barcode),
    escapeCSV(v.display_title),
    escapeCSV(binMap.get(v.id) ?? ""),
  ].join(","));

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows correctly reads
  // special characters like em dashes instead of showing â€" garbage
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

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
