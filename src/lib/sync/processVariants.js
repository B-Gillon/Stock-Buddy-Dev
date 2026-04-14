import { gidToId } from "./shopifyHelpers";

function getVariantList(p) {
  return p.variants?.edges?.map((e) => e.node) || [];
}

function normalizeOptionValue(variant, index) {
  const value = variant.selectedOptions?.[index]?.value;
  if (!value || value === "Default Title" || value === "No Color") return null;
  return value;
}

export default function processVariants(gqlProducts, productIdMap) {
  const variants = [];

  for (const p of gqlProducts) {
    const shopifyProductId = gidToId(p.id);
    const supabaseProductId = productIdMap[shopifyProductId];
    if (!supabaseProductId) continue;

    const variantList = getVariantList(p);

    for (const v of variantList) {
      const shopifyVariantId = gidToId(v.id);
      const optionValues = [
        normalizeOptionValue(v, 0),
        normalizeOptionValue(v, 1),
        normalizeOptionValue(v, 2),
      ].filter(Boolean);

      const productTitle = p.title || "Untitled Product";
      const displayTitle =
        optionValues.length === 0
          ? productTitle
          : `${productTitle} — ${optionValues.join(" / ")}`;

      // Weight comes from inventoryItem.measurement.weight
      const weightData = v.inventoryItem?.measurement?.weight;
      const weightValue = weightData?.value != null ? parseFloat(weightData.value) : null;
      const weightUnit  = weightData?.unit  ?? null;

      variants.push({
        product_id:          supabaseProductId,
        shopify_product_id:  shopifyProductId,
        shopify_variant_id:  shopifyVariantId,
        title:               v.title || null,
        display_title:       displayTitle,
        sku:                 v.sku || null,
        barcode:             v.barcode || null,
        option1:             optionValues[0] || null,
        option2:             optionValues[1] || null,
        option3:             optionValues[2] || null,
        price:               v.price || null,
        compare_at_price:    v.compareAtPrice || null,
        cost:                v.inventoryItem?.unitCost?.amount != null
                               ? parseFloat(parseFloat(v.inventoryItem.unitCost.amount).toFixed(2))
                               : null,
        taxable:             typeof v.taxable === "boolean" ? v.taxable : null,
        inventory_policy:    v.inventoryPolicy || null,
        inventory_quantity:  null, // populated separately via inventory sync
        weight_value:        weightValue,
        weight_unit:         weightUnit,
        image_src:           v.image?.url || p.featuredImage?.url || null,
        created_at:          new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      });
    }
  }

  return variants;
}
