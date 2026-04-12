// /src/app/api/sync-status/route.js
import { NextResponse } from "next/server";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";

export async function GET(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const { data, error } = await supabase.from("sync_status").select("sync_type, last_synced_at");
    if (error) throw error;

    return NextResponse.json(Object.fromEntries((data || []).map((r) => [r.sync_type, r.last_synced_at])));
  } catch (err) {
    await logError({ source: 'api/sync-status/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
