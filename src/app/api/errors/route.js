// The signed-in retailer's own error list (newest first).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';

export async function GET(request) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const tenantId = await getTenantId(request);
    const { data, error } = await supabase.from('error_log').select('id, source, message, stack, context, user_name, created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ errors: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
