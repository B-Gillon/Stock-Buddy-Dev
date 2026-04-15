import { gidToId } from "@/lib/sync/shopifyHelpers";

export default function processInventoryLevels(
  rawLevels,
  inventoryItemMap,
  locationMap
) {
  const processed = [];

  for (const level of rawLevels) {
    const shopifyInventoryItemId = parseInt(
      gidToId(level.shopify_inventory_item_id),
      10
    );
    const shopifyLocationId = parseInt(
      gidToId(level.shopify_location_id),
      10
    );

    // Resolve internal UUIDs
    const inventoryItemUuid = inventoryItemMap.get(shopifyInventoryItemId) ?? null;
    const locationUuid      = locationMap.get(shopifyLocationId)           ?? null;

    if (!locationUuid) {
      console.warn(
        `No matching location found for shopify_location_id: ${shopifyLocationId} — inserting with null location_id`
      );
    }

    if (!inventoryItemUuid) {
      console.warn(
        `No matching inventory item found for shopify_inventory_item_id: ${shopifyInventoryItemId} — skipping row`
      );
      continue;
    }

    processed.push({
      inventory_item_id:  inventoryItemUuid,
      location_id:        locationUuid,
      available:          level.available          ?? null,
      incoming:           level.incoming           ?? null,
      updated_at_shopify: level.updated_at_shopify ?? null,
    });
  }

  return processed;
}
