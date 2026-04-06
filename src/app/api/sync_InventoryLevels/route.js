// /src/app/api/sync_InventoryLevels/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import syncInventoryLevels from "@/lib/sync/syncInventoryLevels";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { count } = await syncInventoryLevels();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Inventory levels sync failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
