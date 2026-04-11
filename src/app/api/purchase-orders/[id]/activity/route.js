// /src/app/api/purchase-orders/[id]/activity/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

export async function GET(request, { params }) {
  try {
    const tenantId = await getTenantId(request);
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
    console.error('[GET /api/purchase-orders/[id]/activity]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
