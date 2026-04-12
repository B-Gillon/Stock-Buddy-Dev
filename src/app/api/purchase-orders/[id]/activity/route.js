// /src/app/api/purchase-orders/[id]/activity/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;

    const { data, error } = await supabase
      .from('po_activity_log')
      .select('id, action, comments, created_at')
      .eq('po_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ log: data ?? [] });
  } catch (err) {
    await logError({ source: 'api/purchase-orders/[id]/activity/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
