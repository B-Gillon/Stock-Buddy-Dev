import { OPEN_STATUSES, NOT_FULLY_SHIPPED_STATUSES, SENT_STATUSES } from '@/lib/poStatus';
import { shippedByLine } from '@/lib/shipments';

const DEFAULT_LOW_STOCK = 5; // used when a product has no low-stock threshold of its own
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
    .select("id, product_id, display_title, title, sku")
    .eq("tenant_id", tenantId)
    .limit(2000);

  const { data: thresholdRows } = await supabase
    .from("products")
    .select("id, low_stock_threshold")
    .eq("tenant_id", tenantId)
    .not("low_stock_threshold", "is", null)
    .limit(5000);
  const thresholdByProduct = Object.fromEntries((thresholdRows ?? []).map((r) => [r.id, r.low_stock_threshold]));

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
      threshold: thresholdByProduct[variantMap[variantId]?.product_id] ?? DEFAULT_LOW_STOCK,
    }))
    .filter((v) => v.available <= v.threshold)
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

  // ── Purchase order report: overdue / due this week / due later / drafts ────
  const { data: reportPOs } = await supabase
    .from("purchase_orders")
    .select("id, status, expected_date, expected_ship_date")
    .eq("tenant_id", tenantId)
    .in("status", [...OPEN_STATUSES, "received"])
    .limit(5000);

  const costByPO = {};
  const readyByPO = {}; // received but not yet put away (units)
  if ((reportPOs ?? []).length) {
    const { data: reportLines } = await supabase
      .from("purchase_order_lines")
      .select("purchase_order_id, order_qty_units, unit_cost, received_qty_units, putaway_qty_units, purchase_orders!inner(status)")
      .eq("tenant_id", tenantId)
      .in("purchase_orders.status", [...OPEN_STATUSES, "received"])
      .range(0, 19999);
    for (const l of reportLines ?? []) {
      costByPO[l.purchase_order_id] = (costByPO[l.purchase_order_id] ?? 0) + (l.order_qty_units ?? 0) * Number(l.unit_cost ?? 0);
      readyByPO[l.purchase_order_id] = (readyByPO[l.purchase_order_id] ?? 0) + Math.max(0, (l.received_qty_units ?? 0) - (l.putaway_qty_units ?? 0));
    }
  }

  // Week = Monday to Sunday (same as the supplier dashboard)
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const weekEnd = new Date(new Date(today + "T00:00:00Z").getTime() + (6 - dow) * 864e5).toISOString().slice(0, 10);

  const report = {
    overdue: { count: 0, cost: 0 }, thisWeek: { count: 0, cost: 0 },
    later: { count: 0, cost: 0 }, transit: { count: 0, cost: 0 }, putaway: { count: 0, cost: 0 }, drafts: { count: 0, cost: 0 },
  };
  const add = (k, po) => { report[k].count += 1; report[k].cost += costByPO[po.id] ?? 0; };
  for (const po of reportPOs ?? []) {
    if (po.status === "draft") { add("drafts", po); continue; }
    if (po.status !== "received" && po.expected_date && po.expected_date < today) { add("overdue", po); continue; } // same rule as the Overdue card
    if ((readyByPO[po.id] ?? 0) > 0) { add("putaway", po); continue; } // received, not yet put away
    if (po.status === "shipped") { add("transit", po); continue; } // shipped, not yet received
    if (!NOT_FULLY_SHIPPED_STATUSES.includes(po.status)) continue; // already shipped: nothing left to ship
    const ship = po.expected_ship_date || po.expected_date;
    if (ship && ship <= weekEnd) add("thisWeek", po); else add("later", po);
  }

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
    .in("purchase_orders.status", OPEN_STATUSES.filter((st) => st !== "draft")); // drafts are not on order yet

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

  // ── Low stock pipeline: On Order / In Transit / Received (not yet put away) ──
  // Sent POs only (no drafts, no cancelled). Per line: on order = ordered - shipped,
  // in transit = shipped - received, received = received - put away.
  const pipeline = {};
  const lowIds = lowStock.map((v) => v.variant_id);
  if (lowIds.length) {
    const { data: pLines } = await supabase
      .from("purchase_order_lines")
      .select("id, variant_id, order_qty_units, received_qty_units, putaway_qty_units, purchase_orders!inner(status)")
      .eq("tenant_id", tenantId)
      .in("variant_id", lowIds)
      .in("purchase_orders.status", [...SENT_STATUSES, "partially_received", "received"]);
    const shippedMap = await shippedByLine((pLines ?? []).map((l) => l.id));
    for (const l of pLines ?? []) {
      const ordered = l.order_qty_units ?? 0, received = l.received_qty_units ?? 0, put = l.putaway_qty_units ?? 0;
      const shipped = Math.max(shippedMap[l.id] ?? 0, received);
      const t = (pipeline[l.variant_id] ??= { onOrder: 0, inTransit: 0, received: 0 });
      t.onOrder += Math.max(0, ordered - shipped);
      t.inTransit += Math.max(0, shipped - received);
      t.received += Math.max(0, received - put);
    }
  }
  const lowStockWithPipeline = lowStock.map((v) => ({ ...v, ...(pipeline[v.variant_id] ?? { onOrder: 0, inTransit: 0, received: 0 }) }));

  // ── Last sync timestamp ────────────────────────────────────────────────────
  const { data: syncStatus } = await supabase
    .from("sync_status")
    .select("last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("sync_type", "all")
    .maybeSingle();

  return (
    <ClientDashboard
      lowStock={lowStockWithPipeline}
      overduePOs={overdueFlat}
      poReport={report}
      totalIncoming={totalIncoming}
      topIncoming={topIncoming}
      lastSyncedAt={syncStatus?.last_synced_at ?? null}
    />
  );
}
