// GET /api/sync/status  → { last_synced_at } for the "Sync Everything" button in the header
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";

export async function GET(request) {
  try {
    const tenantId = await getTenantId(request);
    const { data } = await supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("tenant_id", tenantId)
      .eq("sync_type", "all")
      .maybeSingle();
    return NextResponse.json({ last_synced_at: data?.last_synced_at ?? null });
  } catch {
    return NextResponse.json({ last_synced_at: null });
  }
}
