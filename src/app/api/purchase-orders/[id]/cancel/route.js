// /src/app/api/purchase-orders/[id]/cancel/route.js
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { NextResponse } from 'next/server';
import { logPOActivity } from '@/lib/logPOActivity';
import { logError } from '@/lib/logError';

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
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
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      await logError({ source: 'cancelPO/dbUpdate', error: updateError, tenantId, context: { poId: id } });
      return NextResponse.json({ error: 'Failed to cancel PO' }, { status: 500 });
    }

    await logPOActivity({ poId: id, tenantId, action: 'cancelled' });

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'cancelPO', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
