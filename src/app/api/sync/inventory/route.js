// /src/app/api/sync/inventory/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";
import syncLocations       from "@/lib/sync/syncLocations";
import syncInventoryItems  from "@/lib/sync/syncInventoryItems";
import syncInventoryLevels from "@/lib/sync/syncInventoryLevels";

export async function POST(request) {
  const tenantId = await getTenantId(request);
  const results  = {};
  const errors   = [];

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("shop_domain, access_token")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant?.access_token) {
    return NextResponse.json(
      { success: false, error: "Tenant credentials not found." },
      { status: 401 }
    );
  }

  const credentials = {
    shopDomain:  tenant.shop_domain,
    accessToken: tenant.access_token,
  };

  try { await syncLocations(tenantId, credentials);                  results.locations       = "ok"; }
  catch (err) { errors.push(`locations: ${err.message}`);            results.locations       = "failed"; await logError({ source: 'sync/inventory/syncLocations',       error: err, tenantId }); }

  try { await syncInventoryItems(credentials, tenantId);             results.inventoryItems  = "ok"; }
  catch (err) { errors.push(`inventoryItems: ${err.message}`);       results.inventoryItems  = "failed"; await logError({ source: 'sync/inventory/syncInventoryItems',  error: err, tenantId }); }

  try { await syncInventoryLevels(credentials, tenantId);            results.inventoryLevels = "ok"; }
  catch (err) { errors.push(`inventoryLevels: ${err.message}`);      results.inventoryLevels = "failed"; await logError({ source: 'sync/inventory/syncInventoryLevels', error: err, tenantId }); }

  const last_synced_at = new Date().toISOString();
  await supabase.from("sync_status").upsert(
    { sync_type: "inventory_levels", last_synced_at, tenant_id: tenantId },
    { onConflict: "sync_type,tenant_id" }
  );

  if (errors.length > 0) return NextResponse.json({ success: false, results, errors, last_synced_at }, { status: 207 });
  return NextResponse.json({ success: true, results, last_synced_at });
}
