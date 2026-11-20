// /src/app/api/sync/products/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { logError } from "@/lib/logError";
import { getShopifyCredentials } from "@/lib/shopify/accessToken";
import syncProducts from "@/lib/sync/syncProducts";
import syncVendors  from "@/lib/sync/syncVendors";

export async function POST(request) {
  const tenantId = await getTenantId(request);
  const results  = {};
  const errors   = [];

  // Resolve tenant Shopify credentials
  let credentials = null;
  try {
    credentials = await getShopifyCredentials(tenantId);
  } catch (err) {
    await logError({ source: 'sync/products/tenantLookup', error: err, tenantId });
  }

  // Never fall back to env-level store credentials: require the tenant's own.
  if (!credentials) {
    return NextResponse.json(
      { success: false, error: "Tenant credentials not found." },
      { status: 401 }
    );
  }

  try {
    await syncProducts(credentials, tenantId);
    results.products = "ok";
  } catch (err) {
    errors.push(`products: ${err.message}`);
    results.products = "failed";
    await logError({ source: 'sync/products/syncProducts', error: err, tenantId });
  }

  try {
    await syncVendors(tenantId);
    results.vendors = "ok";
  } catch (err) {
    errors.push(`vendors: ${err.message}`);
    results.vendors = "failed";
    await logError({ source: 'sync/products/syncVendors', error: err, tenantId });
  }

  const last_synced_at = new Date().toISOString();
  await supabase.from("sync_status").upsert(
    { sync_type: "products", last_synced_at, tenant_id: tenantId },
    { onConflict: "sync_type,tenant_id" }
  );

  if (errors.length > 0) {
    return NextResponse.json({ success: false, results, errors, last_synced_at }, { status: 207 });
  }
  return NextResponse.json({ success: true, results, last_synced_at });
}
