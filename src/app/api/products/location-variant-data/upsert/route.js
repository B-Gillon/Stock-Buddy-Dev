// /src/app/api/products/location-variant-data/upsert/route.js

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    const body = await request.json();
    const { variantId, locationId, binLocation } = body;

    if (!variantId || !locationId) {
      return NextResponse.json(
        { error: "variantId and locationId are required" },
        { status: 400 }
      );
    }

    // Verify variant belongs to tenant
    const { data: variant, error: varErr } = await supabase
      .from("variants")
      .select("id")
      .eq("id", variantId)
      .eq("tenant_id", tenantId)
      .single();

    if (varErr || !variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Verify location belongs to tenant
    const { data: location, error: locErr } = await supabase
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("tenant_id", tenantId)
      .single();

    if (locErr || !location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { data: upserted, error: upsertErr } = await supabase
      .from("variant_location_bins")
      .upsert(
        {
          tenant_id:    tenantId,
          variant_id:   variantId,
          location_id:  locationId,
          bin_location: binLocation || null,
          updated_at:   now,
        },
        { onConflict: "variant_id,location_id" }
      )
      .select("id, bin_location, updated_at")
      .single();

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return NextResponse.json({ error: "Failed to save bin location" }, { status: 500 });
    }

    return NextResponse.json({
      success:      true,
      bin_location: upserted.bin_location,
      updated_at:   upserted.updated_at,
    });
  } catch (err) {
    console.error("upsert route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
