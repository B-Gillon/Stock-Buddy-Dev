// GET /api/purchase-orders/[id]/scan?sscc=...
// Looks up a scanned carton label (SSCC) for receiving: what's in the carton, and whether it can be received on this PO.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

/** Accepts "(00)123…", "00123…" (20 digits) or the bare 18-digit SSCC. */
function normalizeScan(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 20 && d.startsWith('00')) return d.slice(2);
  return d;
}

export async function GET(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id: poId } = await params;
    const raw = String(new URL(request.url).searchParams.get('sscc') ?? '').trim().slice(0, 60);
    const digits = raw.replace(/\D/g, '');
    const sscc = normalizeScan(digits);
    if (!raw) return NextResponse.json({ result: 'invalid', message: 'Nothing was scanned.' });

    // Generated SSCC (18 digits, or "00" + 18 as a scanner reads it) or the SSCC Case Number the supplier typed in (any text)
    const cols = 'id, carton_no, received_at, shipment:shipments!shipment_id ( po_id, shipment_number )';
    const idCandidates = [...new Set([raw, digits, `(00)${sscc}`].filter(Boolean))];
    const [{ data: bySscc }, { data: byId }] = await Promise.all([
      sscc.length === 18 ? supabase.from('shipment_cartons').select(cols).eq('tenant_id', tenantId).eq('sscc', sscc) : { data: [] },
      supabase.from('shipment_cartons').select(cols).eq('tenant_id', tenantId).in('supplier_carton_id', idCandidates),
    ]);
    const cartons = [...(bySscc ?? []), ...(byId ?? [])].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    if (!cartons?.length) {
      const { data: old } = await supabase.from('supplier_ssccs').select('id').eq('tenant_id', tenantId).eq('sscc', sscc).not('voided_at', 'is', null).maybeSingle();
      if (old) return NextResponse.json({ result: 'voided', message: 'That label was replaced when the carton was edited. Scan the new label.' });
    }
    if (!cartons?.length) return NextResponse.json({ result: 'not_found', message: `No carton matching ${raw} was found.` });

    const mine = cartons.filter((c) => (Array.isArray(c.shipment) ? c.shipment[0] : c.shipment)?.po_id === poId);
    if (!mine.length) return NextResponse.json({ result: 'other_po', message: 'That carton belongs to a different purchase order.' });
    const c = mine[0];
    const sh = Array.isArray(c.shipment) ? c.shipment[0] : c.shipment;
    if (c.received_at) return NextResponse.json({ result: 'already_received', message: `Carton ${c.carton_no} of ${sh.shipment_number} was already received.` });

    const { data: lines } = await supabase.from('shipment_lines').select('po_line_id, shipped_qty').eq('carton_id', c.id);
    return NextResponse.json({
      result: 'ok', sscc,
      carton: { id: c.id, cartonNo: c.carton_no, shipmentNumber: sh.shipment_number,
        lines: (lines ?? []).map((l) => ({ lineId: l.po_line_id, qty: l.shipped_qty })) },
    });
  } catch (err) {
    return NextResponse.json({ result: 'error', message: err.message }, { status: 500 });
  }
}
