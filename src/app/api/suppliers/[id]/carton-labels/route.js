// Retailer decides whether this supplier may generate SSCC carton labels.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function GET(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
    const { id } = await params;
    const { data } = await supabase.from('suppliers').select('allow_carton_labels').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ allowed: !!data.allow_carton_labels });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/carton-labels/GET', error: err });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const b = await request.json();
    const { data, error } = await supabase.from('suppliers').update({ allow_carton_labels: !!b.allowed })
      .eq('id', id).eq('tenant_id', tenantId).select('allow_carton_labels').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ success: true, allowed: !!data.allow_carton_labels });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/carton-labels/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
