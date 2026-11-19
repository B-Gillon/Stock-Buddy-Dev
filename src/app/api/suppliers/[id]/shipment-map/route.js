// /src/app/api/suppliers/[id]/shipment-map/route.js
// The supplier's shipment-file mapping (Suppliers -> Shipping tab -> Mapping Configuration).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { MAP_FIELD_IDS, DELIMITERS } from '@/lib/shipmentMapFields';

async function assertSupplier(supplierId, tenantId) {
  const { data } = await supabase.from('suppliers').select('id').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const { data } = await supabase.from('supplier_shipment_maps').select('config').eq('supplier_id', id).eq('tenant_id', tenantId).maybeSingle();
    return NextResponse.json({ config: data?.config ?? null });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/shipment-map/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const b = await request.json();

    const map = {};
    for (const fid of MAP_FIELD_IDS) {
      const m = b?.map?.[fid] ?? {};
      const col = Number.isInteger(m.col) && m.col >= 0 && m.col < 200 ? m.col : null;
      const fixed = typeof m.fixed === 'string' && m.fixed.trim() !== '' ? m.fixed.trim().slice(0, 100) : null;
      map[fid] = { col, fixed };
    }
    const config = {
      hasHeader: b.hasHeader !== false,
      delimiter: DELIMITERS.some((d) => d.id === b.delimiter) ? b.delimiter : 'comma',
      sampleName: String(b.sampleName ?? '').slice(0, 200),
      sampleText: String(b.sampleText ?? '').slice(0, 20000), // first lines of the sample file only
      map,
    };
    const { error } = await supabase.from('supplier_shipment_maps')
      .upsert({ tenant_id: tenantId, supplier_id: id, config, updated_at: new Date().toISOString() }, { onConflict: 'supplier_id' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/shipment-map/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
