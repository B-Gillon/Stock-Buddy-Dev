import { gidToId } from "@/lib/sync/shopifyHelpers";

export default function processInventoryItems(rawItems, variantMap) {
  return rawItems.map((item) => {
    const shopifyInventoryItemId = parseInt(gidToId(item.id), 10);
    const shopifyVariantId = item.variant?.id
      ? parseInt(gidToId(item.variant.id), 10)
      : null;

    // variantMap is a Map of shopify_variant_id (bigint) -> uuid
    const variantUuid = shopifyVariantId
      ? (variantMap.get(shopifyVariantId) ?? null)
      : null;

    return {
      shopify_inventory_item_id: shopifyInventoryItemId,
      variant_id: variantUuid,
      sku: item.sku ?? null,
      tracked: item.tracked ?? null,
      cost: item.unitCost?.amount ? parseFloat(item.unitCost.amount) : null,
      country_code_of_origin: item.countryCodeOfOrigin ?? null,
      harmonized_system_code: item.harmonizedSystemCode ?? null,
    };
  });
}