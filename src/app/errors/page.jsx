// /src/app/errors/page.jsx
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabaseClient';
import { getTenantIdFromHeaders } from '@/lib/tenants';
import ErrorsClient from './components/ErrorsClient';

export const dynamic = 'force-dynamic';

export default async function ErrorsPage() {
  const tenantId = await getTenantIdFromHeaders(await headers());
  const { data } = await supabase.from('error_log').select('id, source, message, stack, context, user_name, created_at')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
  return <ErrorsClient initialErrors={data ?? []} />;
}
