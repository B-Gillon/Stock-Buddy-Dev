/**
 * POST /api/purchase-orders/[id]/receive
 *
 * Records receiving for one or more lines on a purchase order.
 *
 * Body: { lines: [{ lineId: string, qtyToReceive: number }] }
 *
 * Returns: { success, results: [{ lineId, success, newPOStatus?, error? }] }
 */
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { receiveInStockBuddy } from "@/lib/sync/po/receivePO";
import { logPOActivity } from "@/lib/logPOActivity";
import { logError } from "@/lib/logError";
import { shippedByLine } from "@/lib/shipments";

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;
    const body = await request.json();
    const { lines } = body;
    const cartonIds = Array.isArray(body.cartonIds) ? body.cartonIds : [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "lines array is required" },
        { status: 400 }
      );
    }

    // Nothing can be received until the supplier has shipped it: per line, received can't pass shipped
    const { data: poLines } = await supabase.from("purchase_order_lines")
      .select("id, sku, title, received_qty_units").eq("purchase_order_id", poId);
    const lineById = new Map((poLines ?? []).map((l) => [l.id, l]));
    const shipped = await shippedByLine([...lineById.keys()]);
    for (const { lineId, qtyToReceive } of lines) {
      const l = lineById.get(lineId);
      if (!l) return NextResponse.json({ success: false, error: "A line does not belong to this purchase order." }, { status: 400 });
      const canReceive = Math.max(0, (shipped[lineId] ?? 0) - (l.received_qty_units ?? 0));
      if ((Number(qtyToReceive) || 0) > canReceive) {
        return NextResponse.json({
          success: false,
          error: `${l.sku || l.title}: only ${canReceive} unit${canReceive === 1 ? "" : "s"} can be received. Items must be shipped by the supplier before they can be received (shipped ${shipped[lineId] ?? 0}, already received ${l.received_qty_units ?? 0}).`,
        }, { status: 409 });
      }
    }

    // Scanned cartons must belong to this PO and not already be received
    if (cartonIds.length) {
      const { data: found } = await supabase.from('shipment_cartons')
        .select('id, received_at, shipment:shipments!shipment_id ( po_id )')
        .eq('tenant_id', tenantId).in('id', cartonIds);
      const okCarton = (c) => (Array.isArray(c.shipment) ? c.shipment[0] : c.shipment)?.po_id === poId && !c.received_at;
      if ((found ?? []).length !== cartonIds.length || !(found ?? []).every(okCarton)) {
        return NextResponse.json({ success: false, error: "A scanned carton was already received or isn't on this PO. Rescan and try again." }, { status: 409 });
      }
    }

    const results = [];

    for (const { lineId, qtyToReceive } of lines) {
      try {
        const result = await receiveInStockBuddy({ poId, lineId, qtyToReceive, tenantId });
        results.push({ lineId, success: true, ...result });
      } catch (lineErr) {
        await logError({
          source: "receivePO/line",
          error: lineErr,
          tenantId,
          context: { poId, lineId, qtyToReceive },
        });
        results.push({ lineId, success: false, error: lineErr.message });
      }
    }

    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      return NextResponse.json({ success: false, results }, { status: 500 });
    }

    if (cartonIds.length && results.every((r) => r.success)) {
      await supabase.from('shipment_cartons').update({ received_at: new Date().toISOString() }).eq('tenant_id', tenantId).in('id', cartonIds);
    }

    await logPOActivity({ poId, tenantId, action: "received", request, comments: cartonIds.length ? `${cartonIds.length} carton${cartonIds.length === 1 ? "" : "s"} received by scan` : undefined });

    return NextResponse.json({ success: true, results });
  } catch (err) {
    const tenantId = null;
    await logError({ source: "receivePO", error: err, tenantId });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// cache-bust
