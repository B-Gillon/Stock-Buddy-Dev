import fetchProducts from "./fetchProducts";
import processProducts from "./processProducts";
import processVariants from "./processVariants";
import { supabase, insertRows, updateSyncStatus } from "./supabaseHelpers";

export default async function syncProducts(credentials = {}) {
  // 1. FETCH PRODUCTS FROM SHOPIFY
  const gqlProducts = await fetchProducts(credentials);

  // 2. PROCESS + INSERT PRODUCTS
  const products = processProducts(gqlProducts);

  // Flatten category BEFORE inserting products
  const flattenedProducts = products.map((p) => {
    const flatCategory = p.category ? p.category.split("/").pop().trim() : "";
    return { ...p, category: flatCategory };
  });

  await insertRows("products", flattenedProducts);
  await updateSyncStatus("products");

  // 3. FETCH REAL PRODUCT UUIDs
  const { data: productRows, error: productFetchError } = await supabase
    .from("products")
    .select("id, shopify_product_id, category, collection, vendor, status, tags");

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

  // 4. PROCESS VARIANTS
  const rawVariants = processVariants(gqlProducts, productIdMap);

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

  await insertRows("variants", variantsToInsert);
  await updateSyncStatus("variants");
}
