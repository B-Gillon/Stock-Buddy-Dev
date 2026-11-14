// /src/app/api/purchase-orders/route.js
import { NextResponse } from 'next/server';
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logPOActivity } from '@/lib/logPOActivity';
import { logError } from '@/lib/logError';

export async function POST(request) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    await setTenantContext(supabase, tenantId);

    const body = await request.json();
    const { header, lines } = body;

    if (!header?.supplier_id) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
    if (!header?.po_date) return NextResponse.json({ error: 'PO Create Date is required' }, { status: 400 });
    if (!header?.expected_date) return NextResponse.json({ error: 'Required Ship Date is required' }, { status: 400 });
    if (!lines || lines.length === 0) return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });

    const { data: settingsRows } = await supabase.from('settings').select('key, value').in('key', ['po_next_number', 'po_format']);
    const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
    const poNextNumber = settings.po_next_number ? parseInt(settings.po_next_number, 10) : null;

    if (!poNextNumber) {
      return NextResponse.json(
        { error: 'PO numbering has not been configured. Please set the Next PO Number in Settings before creating a PO.' },
        { status: 400 }
      );
    }

    const poFormat = settings.po_format || 'PO-{DATE}-{NUM}';
    const datePart = new Date(header.po_date).toISOString().slice(0, 10).replace(/-/g, '');
    const po_number = poFormat
      .replace('{DATE}', datePart)
      .replace('{NUM}', String(poNextNumber).padStart(4, '0'));

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        tenant_id:           tenantId,
        po_number,
        supplier_id:         header.supplier_id,
        ship_to_location_id: header.ship_to_location_id || null,
        status:              'draft',
        po_date:             header.po_date,
        expected_date:       header.expected_date || null,
        notes_internal:      header.notes_internal || null,
        notes_supplier:      header.notes_supplier || null,
        currency_code:       'USD',
      })
      .select('id, po_number')
      .single();

    if (poError) throw poError;

    const lineInserts = lines.map((line, index) => ({
      tenant_id:           tenantId,
      purchase_order_id:   po.id,
      line_no:             index + 1,
      variant_id:          line.variant_id,
      supplier_variant_id: line.supplier_variant_id ?? null,
      sku:                 line.sku ?? null,
      title:               line.title ?? null,
      order_qty_units:     Number.isFinite(line.order_qty_units) ? line.order_qty_units : 0,
      order_qty_cases:     line.order_qty_cases ?? null,
      case_pack_qty:       line.case_pack_qty ?? null,
      unit_cost:           line.unit_cost ?? null,
      extended_cost:       line.extended_cost ?? null,
    }));

    const { error: linesError } = await supabase.from('purchase_order_lines').insert(lineInserts);
    if (linesError) {
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw new Error(`Failed to save line items: ${linesError.message}`);
    }

    await logPOActivity({ poId: po.id, tenantId, action: 'created', request });

    await supabase.from('settings').upsert(
      { tenant_id: tenantId, key: 'po_next_number', value: String(poNextNumber + 1), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

    return NextResponse.json({ id: po.id, slug: po.po_number }, { status: 201 });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
