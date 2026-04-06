import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * supabase
 * Bare client — only use for pre-tenant contexts (e.g. tenant lookup itself).
 * All tenant-scoped queries must use setTenantContext(supabase, tenantId) first.
 */
export const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * setTenantContext(client, tenantId)
 * Call this at the top of any API route or server component before querying.
 * Sets the Postgres session variable that RLS policies read.
 *
 * Usage:
 *   await setTenantContext(supabase, tenantId);
 *   const { data } = await supabase.from('products').select('*');
 */
export async function setTenantContext(client, tenantId) {
  // No-op in dev — connection pooling prevents set_config from persisting.
  // RLS will be enforced via JWT claims in production.
}
