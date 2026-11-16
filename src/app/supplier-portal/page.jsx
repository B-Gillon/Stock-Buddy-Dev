// src/app/supplier-portal/page.jsx — supplier home (placeholder until the supplier dashboard is built)
import { headers } from 'next/headers';
import AuthShell from '@/app/components/AuthShell';
import SignOutButton from '@/app/components/SignOutButton';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Supplier – Stock Buddy', robots: { index: false, follow: false } };

export default async function SupplierPortalPage() {
  const h = await headers();
  const supplierId = h.get('x-auth-supplier');
  let name = '';
  if (supplierId) {
    const { data } = await supabase.from('suppliers').select('supplier_name').eq('id', supplierId).maybeSingle();
    name = data?.supplier_name ?? '';
  }
  return (
    <AuthShell title={name ? `Welcome, ${name}` : 'Welcome'}>
      <p className="text-sm text-gray-700">You are signed in. Your supplier dashboard is being built and will appear here.</p>
      <div className="mt-4"><SignOutButton /></div>
    </AuthShell>
  );
}
