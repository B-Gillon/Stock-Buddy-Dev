// /src/lib/sync/supabaseHelpers.js

import { createClient } from "@supabase/supabase-js";

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Insert or update rows into a table.
 * Stamps tenant_id on every row if provided.
 * Throws on error so callers can handle it.
 */
export async function insertRows(table, rows, tenantId) {
  if (!rows || rows.length === 0) return;

  // Stamp tenant_id on every row
  const stamped = tenantId
    ? rows.map(row => ({ ...row, tenant_id: tenantId }))
    : rows;

  let conflictColumn;
  switch (table) {
    case "products":         conflictColumn = "shopify_product_id";            break;
    case "variants":         conflictColumn = "shopify_variant_id";            break;
    case "locations":        conflictColumn = "shopify_location_id";           break;
    case "inventory_items":  conflictColumn = "shopify_inventory_item_id";     break;
    case "inventory_levels": conflictColumn = "inventory_item_id,location_id"; break;
    case "vendors":          conflictColumn = "name";                          break;
    default:                 conflictColumn = "id";
  }

  const { error } = await supabase.from(table).upsert(stamped, {
    onConflict: conflictColumn,
  });

  if (error) {
    console.error(`Error inserting into ${table}:`, error);
    throw new Error(`Failed to upsert into ${table}: ${error.message}`);
  }
}

/**
 * Update sync_status for a given sync type, scoped to this tenant.
 */
export async function updateSyncStatus(syncType, tenantId) {
  const { error } = await supabase
    .from("sync_status")
    .upsert(
      {
        sync_type:      syncType,
        last_synced_at: new Date().toISOString(),
        tenant_id:      tenantId,
      },
      { onConflict: "sync_type,tenant_id" }
    );

  if (error) {
    console.error("Error updating sync_status:", error);
    throw new Error(`Failed to update sync_status for ${syncType}: ${error.message}`);
  }
}
