// /src/app/admin/activity/page.jsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminActivityClient from './components/AdminActivityClient';

export default async function AdminActivityPage({ searchParams }) {
  // ── Secret key protection ────────────────────────────────────────────────
  const { key } = await searchParams;
  if (key !== process.env.ADMIN_SECRET_KEY) {
    redirect('/dashboard');
  }

  // ── Products & Variants ──────────────────────────────────────────────────
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  const { count: variantCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true });

  const { data: productSyncStatus } = await supabase
    .from('sync_status')
    .select('last_synced_at')
    .eq('sync_type', 'products')
    .single();

  const { data: variantSyncStatus } = await supabase
    .from('sync_status')
    .select('last_synced_at')
    .eq('sync_type', 'variants')
    .single();

  // ── Vendors ──────────────────────────────────────────────────────────────
  const { count: vendorCount } = await supabase
    .from('vendors')
    .select('*', { count: 'exact', head: true });

  const { data: vendorSyncStatus } = await supabase
    .from('sync_status')
    .select('last_synced_at')
    .eq('sync_type', 'vendors')
    .single();

  // ── Inventory ────────────────────────────────────────────────────────────
  const { data: inventorySyncStatus } = await supabase
    .from('sync_status')
    .select('last_synced_at')
    .eq('sync_type', 'all')
    .single();

  // ── Suppliers ────────────────────────────────────────────────────────────
  const { count: supplierCount } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true });

  const { data: latestSupplier } = await supabase
    .from('suppliers')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // ── Supplier Variant Data ────────────────────────────────────────────────
  const { count: supplierVariantCount } = await supabase
    .from('supplier_variants')
    .select('*', { count: 'exact', head: true });

  const { data: latestSupplierVariant } = await supabase
    .from('supplier_variants')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // ── Purchase Orders ──────────────────────────────────────────────────────
  const { count: poTotal } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true });

  const { count: poDraft } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft');

  const { count: poReleased } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'released');

  const { count: poPartiallyReceived } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'partially_received');

  const { count: poReceived } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'received');

  const { count: poCancelled } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelled');

  const { data: latestPO } = await supabase
    .from('purchase_orders')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // ── PO Activity Log ──────────────────────────────────────────────────────
  const { data: poActivity } = await supabase
    .from('po_activity_log')
    .select('id, action, comments, created_at, po_id, purchase_orders(po_number)')
    .order('created_at', { ascending: false })
    .limit(20);

  // ── Error Log ────────────────────────────────────────────────────────────
  const { data: errors } = await supabase
    .from('error_log')
    .select('id, source, message, context, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const { count: errorCount } = await supabase
    .from('error_log')
    .select('*', { count: 'exact', head: true });

  // ── Pass flat props to client ────────────────────────────────────────────
  return (
    <AdminActivityClient
      productCount={productCount ?? 0}
      variantCount={variantCount ?? 0}
      productLastSync={productSyncStatus?.last_synced_at ?? null}
      variantLastSync={variantSyncStatus?.last_synced_at ?? null}
      vendorCount={vendorCount ?? 0}
      vendorLastSync={vendorSyncStatus?.last_synced_at ?? null}
      inventoryLastSync={inventorySyncStatus?.last_synced_at ?? null}
      supplierCount={supplierCount ?? 0}
      supplierLastCreated={latestSupplier?.created_at ?? null}
      supplierVariantCount={supplierVariantCount ?? 0}
      supplierVariantLastCreated={latestSupplierVariant?.created_at ?? null}
      poTotal={poTotal ?? 0}
      poDraft={poDraft ?? 0}
      poReleased={poReleased ?? 0}
      poPartiallyReceived={poPartiallyReceived ?? 0}
      poReceived={poReceived ?? 0}
      poCancelled={poCancelled ?? 0}
      poLastCreated={latestPO?.created_at ?? null}
      poActivity={(poActivity ?? []).map(a => ({
        id: a.id,
        action: a.action,
        comments: a.comments,
        created_at: a.created_at,
        po_number: a.purchase_orders?.po_number ?? 'Unknown',
      }))}
      errors={errors ?? []}
      errorCount={errorCount ?? 0}
    />
  );
}
