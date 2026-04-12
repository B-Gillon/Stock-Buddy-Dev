// /src/app/admin/activity/page.jsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminActivityClient from './components/AdminActivityClient';

export default async function AdminActivityPage({ searchParams }) {
  // ── Secret key protection ────────────────────────────────────────────────
  const { key } = await searchParams;
  if (key !== process.env.ADMIN_SECRET_KEY) {
    redirect('/dashboard');
  }

  // ── Beta Testers ─────────────────────────────────────────────────────────
  const { data: betaTesters } = await supabase
    .from('beta_testers')
    .select('*')
    .order('invited_at', { ascending: false });

  // Last session per tenant
  const { data: lastSessions } = await supabase
    .from('beta_tester_sessions')
    .select('tenant_id, accessed_at')
    .order('accessed_at', { ascending: false });

  // Build a map of tenantId -> last accessed
  const lastSessionMap = {};
  for (const s of (lastSessions ?? [])) {
    if (!lastSessionMap[s.tenant_id]) {
      lastSessionMap[s.tenant_id] = s.accessed_at;
    }
  }

  // ── Per-tenant stats ─────────────────────────────────────────────────────
  const connectedTenantIds = (betaTesters ?? [])
    .filter(t => t.tenant_id)
    .map(t => t.tenant_id);

  const tenantStats = {};
  for (const tenantId of connectedTenantIds) {
    const [
      { count: productCount },
      { count: variantCount },
      { count: vendorCount },
      { count: supplierCount },
      { count: supplierVariantCount },
      { count: poCreated },
      { count: poReleased },
      { count: poReceived },
      { count: errorCount },
      { data: productSync },
      { data: inventorySync },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('variants').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('supplier_variants').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'released'),
      supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'received'),
      supabase.from('error_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('sync_status').select('last_synced_at').eq('tenant_id', tenantId).eq('sync_type', 'products').single(),
      supabase.from('sync_status').select('last_synced_at').eq('tenant_id', tenantId).eq('sync_type', 'all').single(),
    ]);

    tenantStats[tenantId] = {
      productCount:         productCount ?? 0,
      variantCount:         variantCount ?? 0,
      vendorCount:          vendorCount ?? 0,
      supplierCount:        supplierCount ?? 0,
      supplierVariantCount: supplierVariantCount ?? 0,
      poCreated:            poCreated ?? 0,
      poReleased:           poReleased ?? 0,
      poReceived:           poReceived ?? 0,
      errorCount:           errorCount ?? 0,
      productLastSync:      productSync?.last_synced_at ?? null,
      inventoryLastSync:    inventorySync?.last_synced_at ?? null,
    };
  }

  // ── Global stats ─────────────────────────────────────────────────────────
  const { count: productCount }        = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: variantCount }        = await supabase.from('variants').select('*', { count: 'exact', head: true });
  const { data: productSyncStatus }    = await supabase.from('sync_status').select('last_synced_at').eq('sync_type', 'products').single();
  const { data: variantSyncStatus }    = await supabase.from('sync_status').select('last_synced_at').eq('sync_type', 'variants').single();
  const { count: vendorCount }         = await supabase.from('vendors').select('*', { count: 'exact', head: true });
  const { data: vendorSyncStatus }     = await supabase.from('sync_status').select('last_synced_at').eq('sync_type', 'vendors').single();
  const { data: inventorySyncStatus }  = await supabase.from('sync_status').select('last_synced_at').eq('sync_type', 'all').single();
  const { count: supplierCount }       = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
  const { data: latestSupplier }       = await supabase.from('suppliers').select('created_at').order('created_at', { ascending: false }).limit(1).single();
  const { count: supplierVariantCount} = await supabase.from('supplier_variants').select('*', { count: 'exact', head: true });
  const { data: latestSupplierVariant }= await supabase.from('supplier_variants').select('created_at').order('created_at', { ascending: false }).limit(1).single();
  const { count: poTotal }             = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true });
  const { count: poDraft }             = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'draft');
  const { count: poReleased }          = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'released');
  const { count: poPartiallyReceived } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'partially_received');
  const { count: poReceived }          = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'received');
  const { count: poCancelled }         = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
  const { data: latestPO }             = await supabase.from('purchase_orders').select('created_at').order('created_at', { ascending: false }).limit(1).single();
  const { data: poActivity }           = await supabase.from('po_activity_log').select('id, action, comments, created_at, po_id, purchase_orders(po_number)').order('created_at', { ascending: false }).limit(20);
  const { data: errors }               = await supabase.from('error_log').select('id, source, message, context, created_at').order('created_at', { ascending: false }).limit(50);
  const { count: errorCount }          = await supabase.from('error_log').select('*', { count: 'exact', head: true });

  return (
    <AdminActivityClient
      adminKey={key}
      betaTesters={betaTesters ?? []}
      lastSessionMap={lastSessionMap}
      tenantStats={tenantStats}
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
