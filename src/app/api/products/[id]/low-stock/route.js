// PATCH /api/products/[id]/low-stock  { threshold: number | null }
// Sets the product's low-stock threshold (null = use the default).
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function PATCH(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const b = await request.json();
    const raw = b.threshold;
    const threshold = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0 || threshold > 1000000)) {
      return NextResponse.json({ error: 'Enter a whole number of 0 or more.' }, { status: 400 });
    }
    const { data, error } = await supabase.from('products').update({ low_stock_threshold: threshold })
      .eq('id', id).eq('tenant_id', tenantId).select('low_stock_threshold').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, threshold: data.low_stock_threshold });
  } catch (err) {
    await logError({ source: 'api/products/[id]/low-stock', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
