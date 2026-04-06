// /src/app/api/sync_Vendors/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import syncVendors from "@/lib/sync/syncVendors";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { count } = await syncVendors();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Vendors sync failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
