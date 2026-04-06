// /src/app/inventory/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientInventoryPage from "@/app/inventory/components/ClientInventoryPage";

export default async function InventoryPage() {
  const { data: syncStatus } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("sync_type", "inventory_levels")
    .single();

  const { data: variants } = await supabase
    .from("variants")
    .select("id, product_id, display_title, sku, barcode");

  const { data: products } = await supabase
    .from("products")
    .select("id, status, vendor_id");

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, variant_id, cost");

  const { data: inventoryLevels } = await supabase
    .from("inventory_levels")
    .select("inventory_item_id, location_id, available, incoming");

  const productMap  = new Map((products  ?? []).map((p) => [p.id, p]));
  const vendorMap   = new Map((vendors   ?? []).map((v) => [v.id, v.name]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]));

  // Build cost map: inventory_item_id → cost
  const costByItem = new Map((inventoryItems ?? []).map((i) => [i.id, i.cost ?? null]));

  // Build variant_id → inventory_item_id map
  const itemByVariant = new Map((inventoryItems ?? []).map((i) => [i.variant_id, i.id]));

  // Per-location breakdown: inventory_item_id → [{ location_id, location_name, available, incoming }]
  const levelsByItem = new Map();
  for (const level of inventoryLevels ?? []) {
    if (!levelsByItem.has(level.inventory_item_id)) {
      levelsByItem.set(level.inventory_item_id, []);
    }
    levelsByItem.get(level.inventory_item_id).push({
      location_id:   level.location_id,
      location_name: locationMap.get(level.location_id) ?? "Unknown",
      available:     level.available ?? 0,
      incoming:      level.incoming  ?? 0,
    });
  }

  // Aggregate totals per item
  const levelTotals = new Map();
  for (const [itemId, levels] of levelsByItem) {
    levelTotals.set(itemId, {
      available_total: levels.reduce((s, l) => s + l.available, 0),
      incoming_total:  levels.reduce((s, l) => s + l.incoming,  0),
    });
  }

  const enrichedVariants = (variants ?? []).map((variant) => {
    const product = productMap.get(variant.product_id) ?? {};
    const vendor  = vendorMap.get(product.vendor_id) ?? "—";
    const itemId  = itemByVariant.get(variant.id);
    const cost    = itemId ? (costByItem.get(itemId) ?? null) : null;
    const totals  = itemId ? (levelTotals.get(itemId) ?? { available_total: 0, incoming_total: 0 }) : { available_total: 0, incoming_total: 0 };
    const levels  = itemId ? (levelsByItem.get(itemId) ?? []) : [];

    // Enrich location rows with total_value
    const locationRows = levels.map((l) => ({
      ...l,
      total_value: cost != null ? l.available * cost : null,
    }));

    return {
      id:              variant.id,
      display_title:   variant.display_title ?? "—",
      sku:             variant.sku            ?? "—",
      barcode:         variant.barcode        ?? "—",
      status:          product.status         ?? "—",
      vendor_name:     vendor,
      available_total: totals.available_total,
      incoming_total:  totals.incoming_total,
      total_value:     cost != null ? totals.available_total * cost : null,
      location_rows:   locationRows,
    };
  });

  const locationNames = (locations ?? []).map((l) => l.name);

  return (
    <ClientInventoryPage
      inventory={enrichedVariants}
      lastSyncedAt={syncStatus?.last_synced_at ?? null}
      locationNames={locationNames}
    />
  );
}
