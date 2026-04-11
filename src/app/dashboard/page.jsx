// /src/app/dashboard/page.jsx

import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getTenantIdFromHeaders } from "@/lib/tenants";
import ClientDashboard from "./components/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const headersList = await headers();
  const tenantId = await getTenantIdFromHeaders(headersList);

  // ── Card 1: Low Stock ──────────────────────────────────────────────────────
  const { data: inventoryLevels } = await supabase
    .from("inventory_levels")
    .select("inventory_item_id, available")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, variant_id, sku")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const { data: variants } = await supabase
    .from("variants")
    .select("id, display_title, title, sku")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const availByItem = {};
  for (const level of inventoryLevels ?? []) {
    availByItem[level.inventory_item_id] =
      (availByItem[level.inventory_item_id] ?? 0) + (level.available ?? 0);
  }

  const itemMap = {};
  for (const item of inventoryItems ?? []) {
    itemMap[item.id] = item.variant_id;
  }

  const variantAvail = {};
  for (const [itemId, qty] of Object.entries(availByItem)) {
    const variantId = itemMap[itemId];
    if (variantId) {
      variantAvail[variantId] = (variantAvail[variantId] ?? 0) + qty;
    }
  }

  const variantMap = {};
  for (const v of variants ?? []) {
    variantMap[v.id] = v;
  }

  const lowStock = Object.entries(variantAvail)
    .map(([variantId, available]) => ({
      variant_id: variantId,
      title:      variantMap[variantId]?.display_title || variantMap[variantId]?.title || "—",
      sku:        variantMap[variantId]?.sku ?? "—",
      available,
    }))
    .sort((a, b) => a.available - b.available)
    .slice(0, 10);

  // ── Card 2: Overdue Purchase Orders ───────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const { data: overduePOs } = await supabase
    .from("purchase_orders")
    .select("id, po_number, expected_date, suppliers(supplier_name)")
    .eq("tenant_id", tenantId)
    .lt("expected_date", today)
    .not("status", "in", '("draft","received","cancelled")')
    .order("expected_date", { ascending: true });

  const overdueFlat = (overduePOs ?? []).map((po) => ({
    id:            po.id,
    po_number:     po.po_number,
    expected_date: po.expected_date,
    supplier_name: po.suppliers?.supplier_name ?? "—",
  }));

  // ── Card 4: Incoming Inventory ─────────────────────────────────────────────
  const { data: openPOLines } = await supabase
    .from("purchase_order_lines")
    .select(`
      variant_id,
      order_qty_units,
      received_qty_units,
      purchase_orders!inner(
        id,
        po_number,
        status,
        expected_date,
        suppliers(supplier_name)
      )
    `)
    .eq("tenant_id", tenantId)
    .in("purchase_orders.status", ["draft", "released", "partially_received"]);

  const incomingByVariant = {};
  let totalIncoming = 0;

  for (const line of openPOLines ?? []) {
    const incoming = (line.order_qty_units ?? 0) - (line.received_qty_units ?? 0);
    if (incoming <= 0) continue;
    totalIncoming += incoming;
    const vid = line.variant_id;
    if (!incomingByVariant[vid]) {
      incomingByVariant[vid] = {
        variant_id:    vid,
        title:         variantMap[vid]?.display_title || variantMap[vid]?.title || "—",
        supplier_name: line.purchase_orders?.suppliers?.supplier_name ?? "—",
        po_number:     line.purchase_orders?.po_number ?? "—",
        expected_date: line.purchase_orders?.expected_date ?? null,
        incoming,
        po_count:      1,
      };
    } else {
      incomingByVariant[vid].incoming += incoming;
      incomingByVariant[vid].po_count += 1;
      // If spanning multiple POs, show generic label instead of a misleading single PO number
      if (incomingByVariant[vid].po_count > 1) {
        incomingByVariant[vid].po_number = "Multiple POs";
        incomingByVariant[vid].supplier_name = "Multiple Suppliers";
        incomingByVariant[vid].expected_date = null;
      }
    }
  }

  const topIncoming = Object.values(incomingByVariant)
    .sort((a, b) => b.incoming - a.incoming)
    .slice(0, 3);

  // ── Last sync timestamp ────────────────────────────────────────────────────
  const { data: syncStatus } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("sync_type", "all")
    .maybeSingle();

  return (
    <ClientDashboard
      lowStock={lowStock}
      overduePOs={overdueFlat}
      totalIncoming={totalIncoming}
      topIncoming={topIncoming}
      lastSyncedAt={syncStatus?.last_synced_at ?? null}
    />
  );
}
