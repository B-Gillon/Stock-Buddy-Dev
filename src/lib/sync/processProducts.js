import { gidToId } from "./shopifyHelpers";

export default function processProducts(gqlProducts, tenantId) {
  return gqlProducts.map((p) => {
    const tags = Array.isArray(p.tags) ? p.tags : [];

    const fullCategory = p.productCategory?.productTaxonomyNode?.fullName || null;
    const flatCategory = fullCategory
      ? fullCategory.split(">").pop().trim()
      : null;

    return {
      tenant_id:          tenantId,
      shopify_product_id: gidToId(p.id),
      title:              p.title,
      display_title:      p.title,
      description:        p.bodyHtml || null,
      vendor:             p.vendor || null,
      product_type:       p.productType || null,
      category:           flatCategory,
      collection:         p.collections?.edges?.[0]?.node?.title || null,
      image_src:          p.featuredImage?.url || null,
      option1_name:       p.options?.[0]?.name || null,
      option2_name:       p.options?.[1]?.name || null,
      option3_name:       p.options?.[2]?.name || null,
      status:             p.status || null,
      handle:             p.handle || null,
      tags,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    };
  });
}
