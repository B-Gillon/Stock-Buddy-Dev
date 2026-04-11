import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request) {
  try {
    const tenantId = await getTenantId(request);
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const search = searchParams.get("search")?.trim() || "";

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    // Verify location belongs to tenant
    const { data: location, error: locErr } = await supabase
      .from("locations")
      .select("id, name")
      .eq("id", locationId)
      .eq("tenant_id", tenantId)
      .single();

    if (locErr || !location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Load variants + products for this tenant
    let variantQuery = supabase
      .from("variants")
      .select(`
        id,
        shopify_variant_id,
        sku,
        title,
        image_src,
        barcode,
        product_id,
        products!inner (
          id,
          title,
          image_src
        )
      `)
      .eq("tenant_id", tenantId);

    // Apply search filter
    if (search) {
      variantQuery = variantQuery.or(
        `sku.ilike.%${search}%,title.ilike.%${search}%,barcode.ilike.%${search}%`
      );
    }

    const { data: variants, error: varErr } = await variantQuery;

    if (varErr) {
      console.error("Variants query error:", varErr);
      return NextResponse.json({ error: "Failed to load variants" }, { status: 500 });
    }

    if (!variants || variants.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // Filter by product title search (Supabase can't or-filter across joined tables easily)
    const variantIds = variants.map((v) => v.id);
    let filteredVariants = variants;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVariants = variants.filter(
        (v) =>
          (v.sku || "").toLowerCase().includes(searchLower) ||
          (v.title || "").toLowerCase().includes(searchLower) ||
          (v.barcode || "").toLowerCase().includes(searchLower) ||
          (v.products?.title || "").toLowerCase().includes(searchLower)
      );
    }

    const filteredVariantIds = filteredVariants.map((v) => v.id);

    if (filteredVariantIds.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // Load bin data for these variants at this location
    const { data: bins, error: binErr } = await supabase
      .from("variant_location_bins")
      .select("variant_id, location_id, bin_location, updated_at")
      .eq("location_id", locationId)
      .eq("tenant_id", tenantId)
      .in("variant_id", filteredVariantIds);

    if (binErr) {
      console.error("Bins query error:", binErr);
      return NextResponse.json({ error: "Failed to load bin data" }, { status: 500 });
    }

    const binMap = {};
    (bins || []).forEach((b) => {
      binMap[b.variant_id] = b;
    });

    // Flatten rows
    const rows = filteredVariants.map((v) => {
      const bin = binMap[v.id] || null;
      return {
        variant_id: v.id,
        shopify_variant_id: v.shopify_variant_id?.toString() || null,
        sku: v.sku || "",
        variant_title: v.title || "",
        product_title: v.products?.title || "",
        image_src: v.image_src || v.products?.image_src || null,
        location_id: locationId,
        location_name: location.name,
        bin_location: bin?.bin_location || "",
        bin_updated_at: bin?.updated_at || null,
      };
    });

    // Sort by product title, then variant title
    rows.sort((a, b) => {
      const pt = a.product_title.localeCompare(b.product_title);
      if (pt !== 0) return pt;
      return a.variant_title.localeCompare(b.variant_title);
    });

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("location-product-data GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
