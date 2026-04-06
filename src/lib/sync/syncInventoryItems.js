import { supabase } from "@/lib/supabaseClient";
import fetchInventoryItems from "@/lib/sync/fetchInventoryItems";
import processInventoryItems from "@/lib/sync/processInventoryItems";

export default async function syncInventoryItems() {
  // Fetch all variants from Supabase to build shopify_variant_id -> uuid map
  const { data: variants, error: variantError } = await supabase
    .from("variants")
    .select("id, shopify_variant_id");

  if (variantError) {
    throw new Error(`Failed to fetch variants: ${variantError.message}`);
  }

  // Build a Map of shopify_variant_id (bigint) -> uuid for fast lookup
  const variantMap = new Map(
    (variants ?? []).map((v) => [v.shopify_variant_id, v.id])
  );

  // Fetch raw inventory items from Shopify
  const rawItems = await fetchInventoryItems();

  // Process into flat DB records
  const processed = processInventoryItems(rawItems, variantMap);

  if (processed.length === 0) {
    return { count: 0 };
  }

  // Upsert into inventory_items
  const { error: upsertError } = await supabase
    .from("inventory_items")
    .upsert(processed, {
      onConflict: "shopify_inventory_item_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert inventory items: ${upsertError.message}`);
  }

  // Update sync_status
  await supabase
    .from("sync_status")
    .upsert(
      { sync_type: "inventory_items", last_synced_at: new Date().toISOString() },
      { onConflict: "sync_type" }
    );

  return { count: processed.length };
}