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

  // Look up tenant credentials from the database
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("shop_domain, access_token")
    .eq("id", tenantId)
    .single();

  console.log("tenant lookup:", {
    tenantId,
    shop_domain: tenant?.shop_domain,
    has_token: !!tenant?.access_token,
    tenantError: tenantError?.message,
  });

  if (tenantError || !tenant?.access_token) {
    return NextResponse.json(
      { success: false, error: "Tenant credentials not found" },
      { status: 401 }
    );
  }

  const credentials = {
    shopDomain:  tenant.shop_domain,
    accessToken: tenant.access_token,
  };

  try {
    await syncLocations(tenantId, credentials);
    results.locations = "ok";
  } catch (err) {
    console.error("syncLocations error:", err.message, err.stack);
    errors.push(`locations: ${err.message}`);
    results.locations = "failed";
    await logError({ source: 'sync/locations/syncLocations', error: err, tenantId });
  }

  const last_synced_at = new Date().toISOString();
  await supabase.from("sync_status").upsert(
    { sync_type: "locations", last_synced_at, tenant_id: tenantId },
    { onConflict: "sync_type,tenant_id" }
  );

  if (errors.length > 0) return NextResponse.json({ success: false, results, errors, last_synced_at }, { status: 207 });
  return NextResponse.json({ success: true, results, last_synced_at });
}
