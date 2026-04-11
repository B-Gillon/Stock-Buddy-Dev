import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";

function escapeCsvField(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote fields that contain comma, newline, or double-quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(fields) {
  return fields.map(escapeCsvField).join(",");
}

export async function GET(request) {
  try {
    const tenantId = await getTenantId(request);
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const search = searchParams.get("search")?.trim() || "";

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    // Verify location
    const { data: location, error: locErr } = await supabase
      .from("locations")
      .select("id, name")
      .eq("id", locationId)
      .eq("tenant_id", tenantId)
      .single();

    if (locErr || !location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Load variants
    let variantQuery = supabase
      .from("variants")
      .select(`
        id,
        sku,
        title,
        barcode,
        products!inner ( title )
      `)
      .eq("tenant_id", tenantId);

    const { data: variants, error: varErr } = await variantQuery;
    if (varErr) {
      return NextResponse.json({ error: "Failed to load variants" }, { status: 500 });
    }

    let filteredVariants = variants || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVariants = filteredVariants.filter(
        (v) =>
          (v.sku || "").toLowerCase().includes(searchLower) ||
          (v.title || "").toLowerCase().includes(searchLower) ||
          (v.barcode || "").toLowerCase().includes(searchLower) ||
          (v.products?.title || "").toLowerCase().includes(searchLower)
      );
    }

    const variantIds = filteredVariants.map((v) => v.id);

    // Load bins
    const { data: bins } = variantIds.length > 0
      ? await supabase
          .from("variant_location_bins")
          .select("variant_id, bin_location")
          .eq("location_id", locationId)
          .eq("tenant_id", tenantId)
          .in("variant_id", variantIds)
      : { data: [] };

    const binMap = {};
    (bins || []).forEach((b) => { binMap[b.variant_id] = b.bin_location; });

    // Build CSV
    const header = buildCsvRow(["sku", "location_name", "bin_location"]);
    const dataRows = filteredVariants
      .sort((a, b) => {
        const pt = (a.products?.title || "").localeCompare(b.products?.title || "");
        if (pt !== 0) return pt;
        return (a.title || "").localeCompare(b.title || "");
      })
      .map((v) =>
        buildCsvRow([v.sku || "", location.name, binMap[v.id] || ""])
      );

    const csv = [header, ...dataRows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="location_product_data_${location.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  } catch (err) {
    console.error("export route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
