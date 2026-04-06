import { supabase } from "@/lib/supabaseClient";
import fetchInventoryLevels from "@/lib/sync/fetchInventoryLevels";
import processInventoryLevels from "@/lib/sync/processInventoryLevels";

export default async function syncInventoryLevels() {
  // Build shopify_inventory_item_id (bigint) -> uuid map
  const { data: inventoryItems, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, shopify_inventory_item_id");

  if (itemError) {
    throw new Error(`Failed to fetch inventory items: ${itemError.message}`);
  }

  const inventoryItemMap = new Map(
    (inventoryItems ?? []).map((i) => [i.shopify_inventory_item_id, i.id])
  );

  // Build shopify_location_id (bigint) -> uuid map
  const { data: locations, error: locationError } = await supabase
    .from("locations")
    .select("id, shopify_location_id");

  if (locationError) {
    throw new Error(`Failed to fetch locations: ${locationError.message}`);
  }

  const locationMap = new Map(
    (locations ?? []).map((l) => [l.shopify_location_id, l.id])
  );

  // Fetch raw inventory levels from Shopify
  const rawLevels = await fetchInventoryLevels();

  // Process into flat DB records
  const processed = processInventoryLevels(
    rawLevels,
    inventoryItemMap,
    locationMap
  );

  if (processed.length === 0) {
    return { count: 0 };
  }

  // Upsert into inventory_levels
  const { error: upsertError } = await supabase
    .from("inventory_levels")
    .upsert(processed, {
      onConflict: "inventory_item_id,location_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert inventory levels: ${upsertError.message}`);
  }

  // Update sync_status
  await supabase
    .from("sync_status")
    .upsert(
      {
        sync_type: "inventory_levels",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "sync_type" }
    );

  return { count: processed.length };
}