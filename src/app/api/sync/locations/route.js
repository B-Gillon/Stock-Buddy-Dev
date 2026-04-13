// /src/app/api/sync/locations/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";
import syncLocations from "@/lib/sync/syncLocations";

export async function POST(request) {
  const tenantId = await getTenantId(request);
  const results = {};
  const errors  = [];

  try { await syncLocations(tenantId); results.locations = "ok"; }
  catch (err) { errors.push(`locations: ${err.message}`); results.locations = "failed"; await logError({ source: 'sync/locations/syncLocations', error: err, tenantId }); }

  const last_synced_at = new Date().toISOString();
  await supabase.from("sync_status").upsert({ sync_type: "locations", last_synced_at, tenant_id: tenantId }, { onConflict: "sync_type" });

  if (errors.length > 0) return NextResponse.json({ success: false, results, errors, last_synced_at }, { status: 207 });
  return NextResponse.json({ success: true, results, last_synced_at });
}
