// /src/app/api/locations/[slug]/export-csv/route.js
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

/**
 * GET /api/locations/[slug]/export-csv
 * Exports all variants with bin location data for a given location as a CSV
 * in the import format. Includes every variant_location_bins row for this
 * location, even those with no bin_location filled in yet.
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

  // Fetch all variant_location_bins for this location joined to variant data
  const { data, error } = await supabase
    .from("variant_location_bins")
    .select(`
      bin_location,
      variants (
        shopify_variant_id,
        sku
      )
    `)
    .eq("location_id", locationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("export-csv error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  function escapeCSV(value) {
    if (value == null || value === "") return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = ["Variant ID", "SKU", "Bin Location"];

  const rows = (data ?? []).map((row) => {
    const v = row.variants;
    return [
      // Quote Variant ID to prevent scientific notation in Excel
      v?.shopify_variant_id ? `"${v.shopify_variant_id}"` : "",
      escapeCSV(v?.sku),
      escapeCSV(row.bin_location),
    ].join(",");
  });

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
