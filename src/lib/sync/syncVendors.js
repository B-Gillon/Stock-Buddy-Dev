// /src/lib/sync/syncVendors.js
// Derives vendors from the products table and upserts them into the vendors
// table, then back-fills vendor_id on each product row.
// Must run after syncProducts.

import { supabase } from "@/lib/supabaseClient";

export default async function syncVendors(tenantId) {
  if (!tenantId) throw new Error("syncVendors requires a tenantId");

  // ── Fetch products for this tenant with a vendor value ────────────────────
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, vendor")
    .eq("tenant_id", tenantId)
    .not("vendor", "is", null);

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`);

  const distinctVendors = [...new Set(products.map((p) => p.vendor).filter(Boolean))];

  if (distinctVendors.length === 0) {
    await supabase
      .from("sync_status")
      .upsert(
        { sync_type: "vendors", last_synced_at: new Date().toISOString(), tenant_id: tenantId },
        { onConflict: "sync_type,tenant_id" }
      );
    return { count: 0 };
  }

  // ── Upsert vendor rows scoped to this tenant ──────────────────────────────
  // vendors.name is not globally unique — same vendor name can exist across tenants.
  // Upsert on (name, tenant_id) to avoid cross-tenant collisions.
  const { error: upsertError } = await supabase
    .from("vendors")
    .upsert(
      distinctVendors.map((name) => ({ name, tenant_id: tenantId })),
      { onConflict: "name,tenant_id", ignoreDuplicates: true }
    );

  if (upsertError) throw new Error(`Failed to upsert vendors: ${upsertError.message}`);

  // ── Fetch this tenant's vendors to build name → uuid map ──────────────────
  const { data: allVendors, error: vendorFetchError } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("tenant_id", tenantId);

  if (vendorFetchError) throw new Error(`Failed to fetch vendors: ${vendorFetchError.message}`);

  const vendorMap = new Map(allVendors.map((v) => [v.name, v.id]));

  // ── Group product IDs by vendor_id ────────────────────────────────────────
  const vendorToProductIds = new Map();
  for (const product of products) {
    if (!product.vendor || !vendorMap.has(product.vendor)) continue;
    const vendorId = vendorMap.get(product.vendor);
    if (!vendorToProductIds.has(vendorId)) vendorToProductIds.set(vendorId, []);
    vendorToProductIds.get(vendorId).push(product.id);
  }

  // ── Back-fill vendor_id on products ───────────────────────────────────────
  for (const [vendorId, productIds] of vendorToProductIds.entries()) {
    const { error: updateError } = await supabase
      .from("products")
      .update({ vendor_id: vendorId })
      .eq("tenant_id", tenantId)
      .in("id", productIds);
    if (updateError) throw new Error(`Failed to update product vendor_ids: ${updateError.message}`);
  }

  // ── Stamp sync_status ─────────────────────────────────────────────────────
  await supabase
    .from("sync_status")
    .upsert(
      { sync_type: "vendors", last_synced_at: new Date().toISOString(), tenant_id: tenantId },
      { onConflict: "sync_type,tenant_id" }
    );

  return { count: distinctVendors.length };
}
