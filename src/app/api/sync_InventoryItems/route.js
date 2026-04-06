// /src/app/api/sync_InventoryItems/route.js
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import syncInventoryItems from "@/lib/sync/syncInventoryItems";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { count } = await syncInventoryItems();
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Inventory items sync failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
