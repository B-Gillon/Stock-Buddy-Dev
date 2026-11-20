// /src/lib/supplierPortal.js — who the signed-in supplier user is, scoped from the verified headers
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/** Returns { tenantId, supplierId, userId, email, supplierName }. Non-supplier users go back to their own app. */
export async function requireSupplier() {
  const h = await headers();
  if (h.get('x-auth-role') !== 'supplier' || !h.get('x-auth-supplier')) redirect('/dashboard');
  const supplierId = h.get('x-auth-supplier');
  const userId = h.get('x-auth-user');
  const [{ data: sup }, { data: user }] = await Promise.all([
    supabase.from('suppliers').select('supplier_name, tenant_id').eq('id', supplierId).maybeSingle(),
    supabase.from('app_users').select('email, username').eq('id', userId).maybeSingle(),
  ]);
  if (!sup) redirect('/login');
  return { tenantId: sup.tenant_id, supplierId, userId, email: user?.email ?? '', supplierName: sup.supplier_name };
}

export const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return y && m && day ? `${m}/${day}/${y.slice(2)}` : '—';
};
export const money = (n, cur = 'USD') =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n);

/** Marks a PO as retrieved by the supplier (first time only). */
export async function markRetrieved({ poId, tenantId, supplierId, by, method, log = true }) {
  const { logPOActivity } = await import('@/lib/logPOActivity');
  const { data } = await supabase
    .from('purchase_orders')
    .update({ supplier_retrieved_at: new Date().toISOString(), supplier_retrieved_by: by })
    .eq('id', poId).eq('tenant_id', tenantId).eq('supplier_id', supplierId).is('supplier_retrieved_at', null)
    .select('id').maybeSingle();
  if (data && log) await logPOActivity({ poId, tenantId, action: 'retrieved', userName: by, comments: `Retrieved by supplier (${method})` });
}
