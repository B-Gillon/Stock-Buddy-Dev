import { supabase } from "@/lib/supabaseClient";
import fetchInventoryLevels from "@/lib/sync/fetchInventoryLevels";
import processInventoryLevels from "@/lib/sync/processInventoryLevels";

export default async function syncInventoryLevels(credentials = {}, tenantId) {
  if (!tenantId) throw new Error("syncInventoryLevels requires a tenantId");

  // Fetch inventory items scoped to this tenant only
  const { data: inventoryItems, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, shopify_inventory_item_id")
    .eq("tenant_id", tenantId);

  if (itemError) {
    throw new Error(`Failed to fetch inventory items: ${itemError.message}`);
  }

  const inventoryItemMap = new Map(
    (inventoryItems ?? []).map((i) => [i.shopify_inventory_item_id, i.id])
  );

  // Fetch locations scoped to this tenant only
  const { data: locations, error: locationError } = await supabase
    .from("locations")
    .select("id, shopify_location_id")
    .eq("tenant_id", tenantId);

  if (locationError) {
    throw new Error(`Failed to fetch locations: ${locationError.message}`);
  }

  const locationMap = new Map(
    (locations ?? []).map((l) => [l.shopify_location_id, l.id])
  );

  const rawLevels = await fetchInventoryLevels(credentials);
  const processed = processInventoryLevels(rawLevels, inventoryItemMap, locationMap, tenantId);

  if (processed.length === 0) return { count: 0 };

  const { error: upsertError } = await supabase
    .from("inventory_levels")
    .upsert(processed, {
      onConflict:       "inventory_item_id,location_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert inventory levels: ${upsertError.message}`);
  }

  await supabase.from("sync_status").upsert(
    { sync_type: "inventory_levels", last_synced_at: new Date().toISOString(), tenant_id: tenantId },
    { onConflict: "sync_type,tenant_id" }
  );

  return { count: processed.length };
}
