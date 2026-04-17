import { supabase } from "@/lib/supabaseClient";
import fetchInventoryItems from "@/lib/sync/fetchInventoryItems";
import processInventoryItems from "@/lib/sync/processInventoryItems";

export default async function syncInventoryItems(credentials = {}, tenantId) {
  if (!tenantId) throw new Error("syncInventoryItems requires a tenantId");

  // Fetch variants scoped to this tenant only
  const { data: variants, error: variantError } = await supabase
    .from("variants")
    .select("id, shopify_variant_id")
    .eq("tenant_id", tenantId);

  if (variantError) {
    throw new Error(`Failed to fetch variants: ${variantError.message}`);
  }

  const variantMap = new Map(
    (variants ?? []).map((v) => [v.shopify_variant_id, v.id])
  );

  const rawItems  = await fetchInventoryItems(credentials);
  const processed = processInventoryItems(rawItems, variantMap, tenantId);

  if (processed.length === 0) return { count: 0 };

  const { error: upsertError } = await supabase
    .from("inventory_items")
    .upsert(processed, {
      onConflict:       "shopify_inventory_item_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert inventory items: ${upsertError.message}`);
  }

  await supabase.from("sync_status").upsert(
    { sync_type: "inventory_items", last_synced_at: new Date().toISOString(), tenant_id: tenantId },
    { onConflict: "sync_type,tenant_id" }
  );

  return { count: processed.length };
}
