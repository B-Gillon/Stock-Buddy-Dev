// /src/app/products/supplier-variant-data/edit/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientSupplierVariantEditPage from "./components/ClientSupplierVariantEditPage";

export default async function SupplierVariantDataEditPage() {

  const [suppliersRes, rowsRes, syncRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_name, currency")
      .order("supplier_name", { ascending: true }),
    supabase
      .from("supplier_variants")
      .select(`
        id, supplier_id, variant_id, item_code, cost, currency,
        moq, case_pack, inner_pack, order_increment, lead_days,
        initial_average_cost, notes, last_cost_update, updated_at,
        variants (
          id, sku, barcode, display_title, product_id,
          products ( category, collection )
        )
      `)
      .order("updated_at", { ascending: false }),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single(),
  ]);

  const suppliers = suppliersRes.data ?? [];

  const rows = (rowsRes.data ?? []).map((r) => ({
    id:                    r.id,
    supplier_id:           r.supplier_id,
    variant_id:            r.variant_id,
    variant_display_title: r.variants?.display_title        ?? null,
    variant_sku:           r.variants?.sku                  ?? null,
    variant_barcode:       r.variants?.barcode              ?? null,
    product_category:      r.variants?.products?.category   ?? null,
    product_collection:    r.variants?.products?.collection ?? null,
    item_code:             r.item_code                      ?? null,
    cost:                  r.cost != null ? String(r.cost)  : null,
    currency:              r.currency                       ?? null,
    moq:                   r.moq                            ?? null,
    case_pack:             r.case_pack                      ?? null,
    inner_pack:            r.inner_pack                     ?? null,
    order_increment:       r.order_increment                ?? null,
    lead_days:             r.lead_days                      ?? null,
    initial_average_cost:  r.initial_average_cost != null
                             ? String(r.initial_average_cost) : null,
    notes:                 r.notes                          ?? null,
  }));

  const categories = Array.from(
    new Set(rows.map((r) => r.product_category).filter(Boolean))
  ).sort();

  const collections = Array.from(
    new Set(rows.map((r) => r.product_collection).filter(Boolean))
  ).sort();

  return (
    <ClientSupplierVariantEditPage
      suppliers={suppliers}
      initialRows={rows}
      categories={categories}
      collections={collections}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
    />
  );
}
