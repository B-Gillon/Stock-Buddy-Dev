// /src/app/api/sync/inventory/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import syncLocations       from "@/lib/sync/syncLocations";
import syncInventoryItems  from "@/lib/sync/syncInventoryItems";
import syncInventoryLevels from "@/lib/sync/syncInventoryLevels";

export async function POST(request) {
  const tenantId = await getTenantId(request);

  const results = {};
  const errors  = [];

  try {
    await syncLocations();
    results.locations = "ok";
  } catch (err) {
    console.error("syncLocations failed:", err);
    errors.push(`locations: ${err.message}`);
    results.locations = "failed";
  }

  try {
    await syncInventoryItems();
    results.inventoryItems = "ok";
  } catch (err) {
    console.error("syncInventoryItems failed:", err);
    errors.push(`inventoryItems: ${err.message}`);
    results.inventoryItems = "failed";
  }

  try {
    await syncInventoryLevels();
    results.inventoryLevels = "ok";
  } catch (err) {
    console.error("syncInventoryLevels failed:", err);
    errors.push(`inventoryLevels: ${err.message}`);
    results.inventoryLevels = "failed";
  }

  const last_synced_at = new Date().toISOString();
  await supabase
    .from("sync_status")
    .upsert({ sync_type: "inventory", last_synced_at, tenant_id: tenantId }, { onConflict: "sync_type" });

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, results, errors, last_synced_at },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, results, last_synced_at });
}
