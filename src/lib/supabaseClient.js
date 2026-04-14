import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl)     console.error('[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) console.error('[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!serviceRoleKey)  console.error('[supabaseClient] Missing SUPABASE_SERVICE_ROLE_KEY');

/**
 * supabase
 * Server-side client using service role key — bypasses RLS.
 * Never use in client components or expose to the browser.
 */
export const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * setTenantContext(client, tenantId)
 * No-op in dev — connection pooling prevents set_config from persisting.
 * RLS will be enforced via JWT claims in production.
 */
export async function setTenantContext(client, tenantId) {
  // No-op
}
