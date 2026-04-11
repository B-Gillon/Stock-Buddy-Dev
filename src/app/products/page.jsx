// /src/app/products/page.jsx
// SERVER COMPONENT — no "use client"

import { headers } from "next/headers";
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantFromHeaders } from "@/lib/tenants";
import { getStoreSettings } from "@/shared/utils/getStoreSettings";
import ClientProductsPage from "@/app/products/components/ClientProductsPage";

const PAGE_SIZE = 20;

// Parse a comma-separated param into an array of non-empty strings
function parseList(val) {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;

  const headersList = await headers();
  const { tenantId, shopDomain } = await getTenantFromHeaders(headersList);
  await setTenantContext(supabase, tenantId);

  // ── Parse URL params ───────────────────────────────────────────────────────
  const search      = params.search ?? "";
  const vendors     = parseList(params.vendors);
  const categories  = parseList(params.categories);
  const collections = parseList(params.collections);
  const statuses    = parseList(params.status);
  const tags        = parseList(params.tags);
  const sortKey     = params.sort ?? "title";
  const sortDir     = params.dir  ?? "asc";
  const page        = Math.max(1, parseInt(params.page ?? "1", 10));

  // ── Build products query ───────────────────────────────────────────────────
  let query = supabase
    .from("products")
    .select(`
      id,
      shopify_product_id,
      title,
      vendor,
      category,
      collection,
      status,
      handle,
      image_src,
      tags
    `, { count: "exact" })
    .eq("tenant_id", tenantId);

  if (search)            query = query.or(`title.ilike.%${search}%,vendor.ilike.%${search}%,collection.ilike.%${search}%,category.ilike.%${search}%`);
  if (vendors.length)    query = query.in("vendor", vendors);
  if (categories.length) query = query.in("category", categories);
  if (collections.length)query = query.in("collection", collections);
  if (statuses.length)   query = query.in("status", statuses);
  if (tags.length) {
    // Each tag filter requires the tags array to contain that tag — AND logic
    tags.forEach((t) => { query = query.contains("tags", [t]); });
  }

  // Sort
  const validSortKeys = ["title", "vendor", "category", "collection", "status", "handle"];
  const safeSortKey   = validSortKeys.includes(sortKey) ? sortKey : "title";
  query = query.order(safeSortKey, { ascending: sortDir !== "desc" });

  // Paginate
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: products, count } = await query;

  // ── Variant counts for this page only ─────────────────────────────────────
  const productIds = (products ?? []).map((p) => p.id);
  let variantCountMap = new Map();

  if (productIds.length > 0) {
    const { data: variants } = await supabase
      .from("variants")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .in("product_id", productIds);

    for (const v of variants ?? []) {
      variantCountMap.set(v.product_id, (variantCountMap.get(v.product_id) ?? 0) + 1);
    }
  }

  const enrichedProducts = (products ?? []).map((p) => ({
    ...p,
    variant_count: variantCountMap.get(p.id) ?? 0,
  }));

  // ── Filter options (distinct values) ──────────────────────────────────────
  const [vendorsRes, categoriesRes, collectionsRes, tagsRes, syncRes, settings] = await Promise.all([
    supabase.from("products").select("vendor").eq("tenant_id", tenantId).not("vendor", "is", null).order("vendor"),
    supabase.from("products").select("category").eq("tenant_id", tenantId).not("category", "is", null).order("category"),
    supabase.from("products").select("collection").eq("tenant_id", tenantId).not("collection", "is", null).order("collection"),
    supabase.from("products").select("tags").eq("tenant_id", tenantId).not("tags", "is", null),
    supabase.from("sync_status").select("last_synced_at").eq("tenant_id", tenantId).eq("sync_type", "products").single(),
    getStoreSettings(tenantId),
  ]);

  const filterOptions = {
    vendors:     [...new Set((vendorsRes.data     ?? []).map((r) => r.vendor).filter(Boolean))],
    categories:  [...new Set((categoriesRes.data  ?? []).map((r) => r.category).filter(Boolean))],
    collections: [...new Set((collectionsRes.data ?? []).map((r) => r.collection).filter(Boolean))],
    tags:        [...new Set((tagsRes.data        ?? []).flatMap((r) => r.tags ?? []))].sort(),
  };

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <ClientProductsPage
      products={enrichedProducts}
      totalCount={count ?? 0}
      totalPages={totalPages}
      currentPage={page}
      pageSize={PAGE_SIZE}
      currentFilters={{ search, vendors, categories, collections, status: statuses, tags, sort: safeSortKey, dir: sortDir }}
      filterOptions={filterOptions}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
      storeName={settings.store_name}
      shopDomain={`https://${shopDomain}`}
    />
  );
}
