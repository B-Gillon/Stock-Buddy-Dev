// /src/app/api/sync/products/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import syncProducts from "@/lib/sync/syncProducts";
import syncVendors  from "@/lib/sync/syncVendors";

export async function POST(request) {
  const tenantId = await getTenantId(request);

  const results = {};
  const errors  = [];

  try {
    await syncProducts();
    results.products = "ok";
  } catch (err) {
    console.error("syncProducts failed:", err);
    errors.push(`products: ${err.message}`);
    results.products = "failed";
  }

  try {
    await syncVendors();
    results.vendors = "ok";
  } catch (err) {
    console.error("syncVendors failed:", err);
    errors.push(`vendors: ${err.message}`);
    results.vendors = "failed";
  }

  const last_synced_at = new Date().toISOString();
  await supabase
    .from("sync_status")
    .upsert({ sync_type: "products", last_synced_at, tenant_id: tenantId }, { onConflict: "sync_type" });

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, results, errors, last_synced_at },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, results, last_synced_at });
}
