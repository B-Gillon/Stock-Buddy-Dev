/**
 * POST /api/purchase-orders/[id]/putaway
 * Body: { lines: [{ lineId, locations: [{ bin, qty }] }] }
 * Puts received quantity into bin locations. Per line, the total can't exceed received - already put away.
 */
import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenants";
import { supabase } from "@/lib/supabaseClient";
import { logPOActivity } from "@/lib/logPOActivity";
import { logError } from "@/lib/logError";

const BIN_RE = /^\d{1,20}$/;
const bad = (error, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function POST(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;
    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) return bad("Enter a bin location and quantity first.");

    const { data: poLines } = await supabase.from("purchase_order_lines")
      .select("id, sku, title, received_qty_units, putaway_qty_units")
      .eq("tenant_id", tenantId).eq("purchase_order_id", poId);
    const lineById = new Map((poLines ?? []).map((l) => [l.id, l]));

    const rows = [];
    const totals = {};
    for (const { lineId, locations } of lines) {
      const l = lineById.get(lineId);
      if (!l) return bad("A line does not belong to this purchase order.");
      for (const loc of Array.isArray(locations) ? locations : []) {
        const bin = String(loc.bin ?? "").trim();
        const qty = Number(loc.qty);
        if (!BIN_RE.test(bin)) return bad(`${l.sku || l.title}: Bin Location must be a number.`);
        if (!Number.isInteger(qty) || qty <= 0) return bad(`${l.sku || l.title}: Putaway must be a whole number above 0.`);
        rows.push({ tenant_id: tenantId, po_id: poId, po_line_id: lineId, bin_location: bin, qty });
        totals[lineId] = (totals[lineId] ?? 0) + qty;
      }
    }
    if (!rows.length) return bad("Enter a bin location and quantity first.");

    for (const [lineId, total] of Object.entries(totals)) {
      const l = lineById.get(lineId);
      const ready = Math.max(0, (l.received_qty_units ?? 0) - (l.putaway_qty_units ?? 0));
      if (total > ready) {
        return bad(`${l.sku || l.title}: only ${ready} unit${ready === 1 ? "" : "s"} ready for putaway (you entered ${total}).`, 409);
      }
    }

    const { error: insErr } = await supabase.from("po_line_putaways").insert(rows);
    if (insErr) throw new Error(insErr.message);
    for (const [lineId, total] of Object.entries(totals)) {
      const l = lineById.get(lineId);
      const { error } = await supabase.from("purchase_order_lines")
        .update({ putaway_qty_units: (l.putaway_qty_units ?? 0) + total })
        .eq("id", lineId).eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
    }

    const units = rows.reduce((t, r) => t + r.qty, 0);
    await logPOActivity({ poId, tenantId, action: "putaway", request, comments: `${units} unit${units === 1 ? "" : "s"} put away` });
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: "putaway", error: err, tenantId: null });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
