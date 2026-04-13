// /src/app/inventory/page.jsx
// SERVER COMPONENT — no "use client"

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientInventoryPage from "@/app/inventory/components/ClientInventoryPage";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function parseList(val) {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export default async function InventoryPage({ searchParams }) {
  const params = await searchParams;

  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // ── Parse URL params ───────────────────────────────────────────────────────
  const search      = params.search       ?? "";
  const vendors     = parseList(params.vendors);
  const categories  = parseList(params.categories);
  const collections = parseList(params.collections);
  const statuses    = parseList(params.status);
  const tags        = parseList(params.tags);
  const locations   = parseList(params.locations);
  const availability     = params.availability     ?? "";
  const incoming         = params.incoming         ?? "";
  const total_value      = params.total_value      ?? "";
  const inventory_policy = params.inventory_policy ?? "";
  const sortKey = params.sort ?? "display_title";
  const sortDir = params.dir  ?? "asc";
  const page    = Math.max(1, parseInt(params.page ?? "1", 10));

  // ── Build inventory_summary query ─────────────────────────────────────────
  let query = supabase
    .from("inventory_summary")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (search)            query = query.or(`display_title.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  if (vendors.length)    query = query.in("vendor_name", vendors);
  if (categories.length) query = query.in("category", categories);
  if (collections.length)query = query.in("collection", collections);
  if (statuses.length)   query = query.in("status", statuses);
  if (tags.length)       tags.forEach((t) => { query = query.contains("tags", [t]); });

  if (availability === "in_stock")     query = query.gt("available_total", 0);
  if (availability === "out_of_stock") query = query.eq("available_total", 0);
  if (availability === "low_stock")    query = query.gt("available_total", 0).lte("available_total", 4);
  if (incoming === "has_incoming")     query = query.gt("incoming_total", 0);
  if (incoming === "no_incoming")      query = query.eq("incoming_total", 0);
  if (total_value === "has_value")     query = query.gt("total_value", 0);
  if (total_value === "no_value")      query = query.eq("total_value", 0);
  if (inventory_policy)                query = query.ilike("inventory_policy", inventory_policy);

  const validSortKeys = ["display_title", "vendor_name", "sku", "status", "available_total", "incoming_total", "total_value"];
  const safeSortKey   = validSortKeys.includes(sortKey) ? sortKey : "display_title";
  query = query.order(safeSortKey, { ascending: sortDir !== "desc" });

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: summaryRows, count } = await query;

  // ── Per-location breakdown for this page's variants ───────────────────────
  const variantIds = (summaryRows ?? []).map((r) => r.variant_id);
  let locationRowsByVariant = {};

  if (variantIds.length > 0) {
    const { data: levels } = await supabase
      .from("inventory_levels")
      .select(`
        inventory_item_id,
        location_id,
        available,
        incoming,
        inventory_items!inner( variant_id, cost ),
        locations!inner( name )
      `)
      .eq("tenant_id", tenantId)
      .in("inventory_items.variant_id", variantIds);

    for (const level of levels ?? []) {
      const vid = level.inventory_items?.variant_id;
      if (!vid) continue;
      if (!locationRowsByVariant[vid]) locationRowsByVariant[vid] = [];
      const cost = level.inventory_items?.cost ?? null;
      locationRowsByVariant[vid].push({
        location_id:   level.location_id,
        location_name: level.locations?.name ?? "Unknown",
        available:     level.available ?? 0,
        incoming:      level.incoming  ?? 0,
        total_value:   cost != null ? (level.available ?? 0) * cost : null,
      });
    }
  }

  const inventory = (summaryRows ?? []).map((row) => ({
    id:              row.variant_id,
    display_title:   row.display_title ?? "—",
    sku:             row.sku           ?? "—",
    barcode:         row.barcode       ?? "—",
    status:          row.status        ?? "—",
    vendor_name:     row.vendor_name   ?? "—",
    category:        row.category      ?? null,
    collection:      row.collection    ?? null,
    tags:            row.tags          ?? [],
    inventory_policy: row.inventory_policy ?? null,
    available_total: row.available_total ?? 0,
    incoming_total:  row.incoming_total  ?? 0,
    total_value:     row.total_value     ?? null,
    unit_cost:       row.unit_cost       ?? null,
    location_rows:   locationRowsByVariant[row.variant_id] ?? [],
  }));

  const filteredInventory = locations.length > 0
    ? inventory.filter((r) => r.location_rows.some((l) => locations.includes(l.location_name)))
    : inventory;

  // ── Filter options ─────────────────────────────────────────────────────────
  const [vendorsRes, categoriesRes, collectionsRes, tagsRes, locationsRes, syncRes] = await Promise.all([
    supabase.from("inventory_summary").select("vendor_name").eq("tenant_id", tenantId).not("vendor_name", "is", null).order("vendor_name"),
    supabase.from("inventory_summary").select("category").eq("tenant_id", tenantId).not("category", "is", null).order("category"),
    supabase.from("inventory_summary").select("collection").eq("tenant_id", tenantId).not("collection", "is", null).order("collection"),
    supabase.from("inventory_summary").select("tags").eq("tenant_id", tenantId).not("tags", "is", null),
    supabase.from("locations").select("name").eq("tenant_id", tenantId).eq("active", true).order("name"),
    supabase.from("sync_status").select("last_synced_at").eq("tenant_id", tenantId).eq("sync_type", "inventory_levels").maybeSingle(),
  ]);

  const filterOptions = {
    vendors:     [...new Set((vendorsRes.data     ?? []).map((r) => r.vendor_name).filter(Boolean))],
    categories:  [...new Set((categoriesRes.data  ?? []).map((r) => r.category).filter(Boolean))],
    collections: [...new Set((collectionsRes.data ?? []).map((r) => r.collection).filter(Boolean))],
    tags:        [...new Set((tagsRes.data        ?? []).flatMap((r) => r.tags ?? []))].sort(),
    locations:   (locationsRes.data ?? []).map((l) => l.name),
  };

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <ClientInventoryPage
      inventory={filteredInventory}
      totalCount={count ?? 0}
      totalPages={totalPages}
      currentPage={page}
      pageSize={PAGE_SIZE}
      currentFilters={{
        search, vendors, categories, collections, status: statuses,
        tags, locations, availability, incoming, total_value,
        inventory_policy, sort: safeSortKey, dir: sortDir,
      }}
      filterOptions={filterOptions}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
    />
  );
}
