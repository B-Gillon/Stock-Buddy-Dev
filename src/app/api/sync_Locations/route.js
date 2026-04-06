// /src/app/api/sync_Locations/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import syncLocations from "@/lib/sync/syncLocations";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    await syncLocations();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Locations sync failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
