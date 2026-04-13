// /src/app/vendors/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientVendorsPage from "@/app/vendors/components/ClientVendorsPage";

export const dynamic = "force-dynamic";

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default async function VendorsPage() {
  const { data: syncStatus } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("sync_type", "vendors")
    .single();

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  const { data: products } = await supabase
    .from("products")
    .select("id, vendor_id, product_type, status, updated_at")
    .limit(500);

  const { data: variants } = await supabase
    .from("variants")
    .select("id, product_id")
    .limit(2000);

  const productsByVendor = new Map();
  for (const product of products ?? []) {
    if (!product.vendor_id) continue;
    if (!productsByVendor.has(product.vendor_id)) {
      productsByVendor.set(product.vendor_id, []);
    }
    productsByVendor.get(product.vendor_id).push(product);
  }

  const variantCountByProduct = new Map();
  for (const variant of variants ?? []) {
    if (!variant.product_id) continue;
    variantCountByProduct.set(
      variant.product_id,
      (variantCountByProduct.get(variant.product_id) ?? 0) + 1
    );
  }

  const enrichedVendors = (vendors ?? []).map((vendor) => {
    const vendorProducts = productsByVendor.get(vendor.id) ?? [];
    const productCount   = vendorProducts.length;
    const variantCount   = vendorProducts.reduce(
      (sum, p) => sum + (variantCountByProduct.get(p.id) ?? 0), 0
    );
    const productTypes = [
      ...new Set(vendorProducts.map((p) => p.product_type).filter(Boolean)),
    ].join(", ") || "—";

    // active = status is exactly "active"; inactive = everything else
    const activeCount   = vendorProducts.filter((p) => p.status === "active").length;
    const inactiveCount = vendorProducts.filter((p) => p.status !== "active").length;

    const latestUpdatedAt = vendorProducts.reduce((latest, p) => {
      if (!p.updated_at) return latest;
      if (!latest) return p.updated_at;
      return p.updated_at > latest ? p.updated_at : latest;
    }, null);

    return {
      id:                vendor.id,
      name:              vendor.name,
      slug:              toSlug(vendor.name),
      product_count:     productCount,
      variant_count:     variantCount,
      product_types:     productTypes,
      active_count:      activeCount,
      inactive_count:    inactiveCount,
      latest_updated_at: latestUpdatedAt,
    };
  });

  return (
    <ClientVendorsPage
      vendors={enrichedVendors}
      lastSyncedAt={syncStatus?.last_synced_at ?? null}
    />
  );
}
