// Per-supplier visibility of the manual shipping fields (Suppliers -> Shipping tab).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { loadShipmentConfig } from '@/lib/shipmentSettings';
import { SUPPLIER_CONTROLLED_FIELDS } from '@/lib/shipmentFields';

async function state(tenantId, id) {
  const { data } = await supabase.from('suppliers').select('shipping_field_overrides, enforce_valid_sscc').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
  if (!data) return null;
  const global = await loadShipmentConfig(tenantId); // retailer-wide settings
  const overrides = data.shipping_field_overrides ?? {};
  return {
    enforceValidSscc: !!data.enforce_valid_sscc,
    fields: SUPPLIER_CONTROLLED_FIELDS.map((f) => ({
      id: f.id, label: f.label,
      visible: typeof overrides[f.id] === 'boolean' ? overrides[f.id] : !!global[f.section][f.id].visible,
    })),
  };
}

export async function GET(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const tenantId = await getTenantId(request);
    const { id } = await params;
    const st = await state(tenantId, id);
    if (!st) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json(st);
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/shipping-fields/GET', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const body = await request.json();
    const global = await loadShipmentConfig(tenantId);
    // Store only the fields that differ from the retailer-wide setting, so the rest keep following it
    const overrides = {};
    for (const f of SUPPLIER_CONTROLLED_FIELDS) {
      const want = body?.visible?.[f.id];
      if (typeof want === 'boolean' && want !== !!global[f.section][f.id].visible) overrides[f.id] = want;
    }
    const { data, error } = await supabase.from('suppliers').update({ shipping_field_overrides: overrides, enforce_valid_sscc: !!body?.enforceValidSscc })
      .eq('id', id).eq('tenant_id', tenantId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...(await state(tenantId, id)) });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/shipping-fields/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
