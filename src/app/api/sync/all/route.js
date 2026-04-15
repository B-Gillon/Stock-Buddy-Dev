// /src/app/api/sync/all/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";
import syncProducts        from "@/lib/sync/syncProducts";
import syncVendors         from "@/lib/sync/syncVendors";
import syncLocations       from "@/lib/sync/syncLocations";
import syncInventoryItems  from "@/lib/sync/syncInventoryItems";
import syncInventoryLevels from "@/lib/sync/syncInventoryLevels";

export async function POST(request) {
  const tenantId = await getTenantId(request);
  const results  = {};
  const errors   = [];

  // Look up tenant credentials from the tenants table
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

  try { await syncProducts(credentials);        results.products        = "ok"; }
  catch (err) { console.error("syncProducts failed:", err);        errors.push(`products: ${err.message}`);        results.products        = "failed"; await logError({ source: "syncProducts",        error: err, tenantId }); }

  try { await syncVendors(credentials);         results.vendors         = "ok"; }
  catch (err) { console.error("syncVendors failed:", err);         errors.push(`vendors: ${err.message}`);         results.vendors         = "failed"; await logError({ source: "syncVendors",         error: err, tenantId }); }

  try { await syncLocations(tenantId, credentials);      results.locations       = "ok"; }
  catch (err) { console.error("syncLocations failed:", err);       errors.push(`locations: ${err.message}`);       results.locations       = "failed"; await logError({ source: "syncLocations",       error: err, tenantId }); }

  try { await syncInventoryItems(credentials);  results.inventoryItems  = "ok"; }
  catch (err) { console.error("syncInventoryItems failed:", err);  errors.push(`inventoryItems: ${err.message}`);  results.inventoryItems  = "failed"; await logError({ source: "syncInventoryItems",  error: err, tenantId }); }

  try { await syncInventoryLevels(credentials); results.inventoryLevels = "ok"; }
  catch (err) { console.error("syncInventoryLevels failed:", err); errors.push(`inventoryLevels: ${err.message}`); results.inventoryLevels = "failed"; await logError({ source: "syncInventoryLevels", error: err, tenantId }); }

  const last_synced_at = new Date().toISOString();
  await supabase.from("sync_status").upsert(
    { sync_type: "all", last_synced_at, tenant_id: tenantId },
    { onConflict: "sync_type" }
  );

  if (errors.length > 0) return NextResponse.json({ success: false, results, errors, last_synced_at }, { status: 207 });
  return NextResponse.json({ success: true, results, last_synced_at });
}
