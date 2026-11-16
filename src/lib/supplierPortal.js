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
    supabase.from('app_users').select('email').eq('id', userId).maybeSingle(),
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
