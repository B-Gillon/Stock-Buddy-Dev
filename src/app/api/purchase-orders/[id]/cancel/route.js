// /src/app/api/purchase-orders/[id]/cancel/route.js
import { supabase, setTenantContext } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { id } = await params;

  const { data: po, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError || !po) {
    return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  }

  if (po.status === 'cancelled') {
    return NextResponse.json({ error: 'PO is already cancelled' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Cancel PO error:', updateError);
    return NextResponse.json({ error: 'Failed to cancel PO' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
