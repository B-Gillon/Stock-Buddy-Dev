// Delete one of the signed-in retailer's errors.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

export async function DELETE(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const tenantId = await getTenantId(request);
    const { id } = await params;
    const { error } = await supabase.from('error_log').delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
