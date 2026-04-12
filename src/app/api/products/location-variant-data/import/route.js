// /src/app/api/products/location-variant-data/import/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { logError } from "@/lib/logError";

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const body = await request.json();
    const { rows, location_id } = body;

    if (!location_id) return NextResponse.json({ error: "location_id is required" }, { status: 400 });
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });

    const { data: location, error: locErr } = await supabase.from("locations").select("id").eq("id", location_id).eq("tenant_id", tenantId).single();
    if (locErr || !location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    const { data: variants, error: varErr } = await supabase.from("variants").select("id, shopify_variant_id").eq("tenant_id", tenantId);
    if (varErr) throw varErr;

    const variantIdMap = {};
    (variants ?? []).forEach((v) => { variantIdMap[String(v.shopify_variant_id)] = v.id; });

    const DELETE_MARKER = "/";
    const now = new Date().toISOString();
    const upserts = [];

    for (const row of rows) {
      const variantUuid = variantIdMap[String(row.variant_id)];
      if (!variantUuid) continue;
      const binLocation = row.fields?.["Bin Location"];
      const resolvedBin = binLocation === DELETE_MARKER ? null : binLocation === undefined ? undefined : binLocation;
      if (resolvedBin === undefined) continue;
      upserts.push({ tenant_id: tenantId, variant_id: variantUuid, location_id, bin_location: resolvedBin, updated_at: now });
    }

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase.from("variant_location_bins").upsert(upserts, { onConflict: "variant_id,location_id" });
      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({ imported: upserts.length });
  } catch (err) {
    await logError({ source: 'api/products/location-variant-data/import/POST', error: err, tenantId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
