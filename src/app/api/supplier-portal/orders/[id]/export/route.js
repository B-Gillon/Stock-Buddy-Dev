// Supplier downloads a PO as PDF or CSV. Ownership is checked against the verified session,
// then the existing export handlers build the file, and the PO is marked as retrieved.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { markRetrieved } from '@/lib/supplierPortal';
import { GET as pdf } from '@/app/api/purchase-orders/[id]/export-pdf/route';
import { GET as csv } from '@/app/api/purchase-orders/[id]/export-csv/route';

export async function GET(request, { params }) {
  const supplierId = request.headers.get('x-auth-supplier');
  const userId = request.headers.get('x-auth-user');
  if (request.headers.get('x-auth-role') !== 'supplier' || !supplierId || !userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'pdf';

  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email').eq('id', userId).maybeSingle(),
  ]);
  if (!sup || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: po } = await supabase.from('purchase_orders').select('id')
    .eq('id', id).eq('tenant_id', sup.tenant_id).eq('supplier_id', supplierId).neq('status', 'draft').maybeSingle();
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = await (format === 'csv' ? csv : pdf)(request, { params: Promise.resolve({ id }) });
  if (res.ok) {
    await markRetrieved({ poId: id, tenantId: sup.tenant_id, supplierId, by: user.email, method: format.toUpperCase() });
  }
  return res;
}
