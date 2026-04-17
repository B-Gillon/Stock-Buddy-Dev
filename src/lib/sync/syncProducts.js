import fetchProducts from "./fetchProducts";
import processProducts from "./processProducts";
import processVariants from "./processVariants";
import { supabase, insertRows, updateSyncStatus } from "./supabaseHelpers";

export default async function syncProducts(credentials = {}, tenantId) {
  if (!tenantId) throw new Error("syncProducts requires a tenantId");

  // 1. FETCH PRODUCTS FROM SHOPIFY
  const gqlProducts = await fetchProducts(credentials);

  // 2. PROCESS + INSERT PRODUCTS (tenant_id stamped in processProducts)
  const products = processProducts(gqlProducts, tenantId);

  const flattenedProducts = products.map((p) => {
    const flatCategory = p.category ? p.category.split("/").pop().trim() : "";
    return { ...p, category: flatCategory };
  });

  await insertRows("products", flattenedProducts, tenantId);
  await updateSyncStatus("products", tenantId);

  // 3. FETCH REAL PRODUCT UUIDs — scoped to this tenant only
  const { data: productRows, error: productFetchError } = await supabase
    .from("products")
    .select("id, shopify_product_id, category, collection, vendor, status, tags")
    .eq("tenant_id", tenantId);

  if (productFetchError) {
    console.error("Error fetching product UUIDs:", productFetchError);
    return;
  }

  // Build lookup maps
  const productIdMap = {};
  const productLookup = {};
  for (const row of productRows) {
    productIdMap[row.shopify_product_id] = row.id;
    productLookup[row.id] = {
      category:   row.category   || "",
      collection: row.collection || "",
      vendor:     row.vendor     || "",
      status:     row.status     || "",
      tags:       Array.isArray(row.tags) ? row.tags : [],
    };
  }

  // 4. PROCESS VARIANTS (tenant_id passed through)
  const rawVariants = processVariants(gqlProducts, productIdMap, tenantId);

  // 5. FLATTEN VARIANTS WITH LOOKUP FIELDS
  const flattenedVariants = rawVariants.map((variant) => {
    const parent = productLookup[variant.product_id] || {};
    return {
      ...variant,
      product_category:   parent.category   || "",
      product_collection: parent.collection || "",
      product_vendor:     parent.vendor     || "",
      product_status:     parent.status     || "",
      product_tags:       Array.isArray(parent.tags) ? parent.tags : [],
    };
  });

  // 6. INSERT VARIANTS — strip lookup fields not in the variants table schema
  const variantsToInsert = flattenedVariants.map(({
    product_category,
    product_collection,
    product_vendor,
    product_status,
    product_tags,
    ...rest
  }) => rest);

  await insertRows("variants", variantsToInsert, tenantId);
  await updateSyncStatus("variants", tenantId);
}
