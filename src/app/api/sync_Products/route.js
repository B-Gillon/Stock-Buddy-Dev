// /src/app/api/sync_Products/route.js
import { NextResponse } from "next/server";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import syncProducts from "@/lib/sync/syncProducts";

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    await syncProducts();

    const { data } = await supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single();

    return NextResponse.json({
      success: true,
      last_synced_at: data?.last_synced_at ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("Sync API error:", err);
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
