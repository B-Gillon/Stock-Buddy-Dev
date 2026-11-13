// /src/app/admin/activity/page.jsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminActivityClient from './components/AdminActivityClient';

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }) {
  const { key } = await searchParams;
  if (!process.env.ADMIN_SECRET_KEY || key !== process.env.ADMIN_SECRET_KEY) redirect('/dashboard');

  // ── Beta Testers ─────────────────────────────────────────────────────────
  const { data: betaTestersRaw } = await supabase
    .from('beta_testers')
    .select('*')
    .order('invited_at', { ascending: false });

  // Join against tenants on shopify_domain so tenant_id is populated
  // even if it wasn't explicitly written to beta_testers at install time.
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, shop_domain');

  const tenantByDomain = {};
  for (const t of (tenants ?? [])) {
    tenantByDomain[t.shop_domain] = t;
  }

  const betaTesters = (betaTestersRaw ?? []).map((bt) => {
    if (bt.tenant_id) return bt;
    const matched = bt.shopify_domain ? tenantByDomain[bt.shopify_domain] : null;
    return matched ? { ...bt, tenant_id: matched.id } : bt;
  });

  const { data: lastSessions } = await supabase
    .from('beta_tester_sessions')
    .select('tenant_id, accessed_at')
    .order('accessed_at', { ascending: false });

  const lastSessionMap = {};
  for (const s of (lastSessions ?? [])) {
    if (!lastSessionMap[s.tenant_id]) lastSessionMap[s.tenant_id] = s.accessed_at;
  }

  // ── Per-tenant stats ─────────────────────────────────────────────────────
  const connectedTenantIds = betaTesters.filter(t => t.tenant_id).map(t => t.tenant_id);
  const tenantStats = {};

  for (const tenantId of connectedTenantIds) {
    const [
      { count: productCount },
      { count: variantCount },
      { count: vendorCount },
      { count: supplierCount },
      { count: supplierVariantCount },
      { count: locationVariantCount },
      { count: poTotal },
      { count: errorCount },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('variants').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('supplier_variants').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('variant_location_bins').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('error_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    tenantStats[tenantId] = {
      productCount:         productCount ?? 0,
      variantCount:         variantCount ?? 0,
      vendorCount:          vendorCount ?? 0,
      supplierCount:        supplierCount ?? 0,
      supplierVariantCount: supplierVariantCount ?? 0,
      locationVariantCount: locationVariantCount ?? 0,
      poTotal:              poTotal ?? 0,
      errorCount:           errorCount ?? 0,
    };
  }

  // ── Global totals (across all tenants) ───────────────────────────────────
  const { count: productCount }         = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: variantCount }         = await supabase.from('variants').select('*', { count: 'exact', head: true });
  const { count: vendorCount }          = await supabase.from('vendors').select('*', { count: 'exact', head: true });
  const { count: supplierCount }        = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
  const { count: supplierVariantCount } = await supabase.from('supplier_variants').select('*', { count: 'exact', head: true });
  const { count: locationVariantCount } = await supabase.from('variant_location_bins').select('*', { count: 'exact', head: true });
  const { count: poTotal }              = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true });
  const { count: errorCount }           = await supabase.from('error_log').select('*', { count: 'exact', head: true });

  // Fetch errors with tenant_id so the client can show Account Name
  const { data: errors } = await supabase
    .from('error_log')
    .select('id, source, message, context, created_at, tenant_id')
    .order('created_at', { ascending: false })
    .limit(50);

  // Build tenantId → contact_name map for error log Account Name column
  const tenantNameMap = {};
  for (const bt of betaTesters) {
    if (bt.tenant_id) tenantNameMap[bt.tenant_id] = bt.contact_name;
  }

  return (
    <AdminActivityClient
      adminKey={key}
      betaTesters={betaTesters}
      lastSessionMap={lastSessionMap}
      tenantStats={tenantStats}
      globalTotals={{
        productCount:         productCount ?? 0,
        variantCount:         variantCount ?? 0,
        vendorCount:          vendorCount ?? 0,
        supplierCount:        supplierCount ?? 0,
        supplierVariantCount: supplierVariantCount ?? 0,
        locationVariantCount: locationVariantCount ?? 0,
        poTotal:              poTotal ?? 0,
      }}
      errors={errors ?? []}
      errorCount={errorCount ?? 0}
      tenantNameMap={tenantNameMap}
    />
  );
}
