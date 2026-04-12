// /src/app/api/products/location-variant-data/upsert/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logError";

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const body = await request.json();
    const { variantId, locationId, binLocation } = body;

    if (!variantId || !locationId) return NextResponse.json({ error: "variantId and locationId are required" }, { status: 400 });

    const { data: variant, error: varErr } = await supabase.from("variants").select("id").eq("id", variantId).eq("tenant_id", tenantId).single();
    if (varErr || !variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    const { data: location, error: locErr } = await supabase.from("locations").select("id").eq("id", locationId).eq("tenant_id", tenantId).single();
    if (locErr || !location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    const { data: upserted, error: upsertErr } = await supabase
      .from("variant_location_bins")
      .upsert({ tenant_id: tenantId, variant_id: variantId, location_id: locationId, bin_location: binLocation || null, updated_at: new Date().toISOString() }, { onConflict: "variant_id,location_id" })
      .select("id, bin_location, updated_at").single();

    if (upsertErr) throw upsertErr;
    return NextResponse.json({ success: true, bin_location: upserted.bin_location, updated_at: upserted.updated_at });
  } catch (err) {
    await logError({ source: 'api/products/location-variant-data/upsert/POST', error: err, tenantId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
