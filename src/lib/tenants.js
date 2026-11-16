import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Local development convenience only. In production the store comes solely from the verified
// session set by the proxy (src/proxy.js).
const devShop = () =>
  process.env.NODE_ENV === 'production' ? undefined : (process.env.NEXT_PUBLIC_DEV_SHOP_DOMAIN || process.env.DEV_SHOP_DOMAIN);

/**
 * resolveTenant(request)
 * For use in API routes — reads x-shop-domain from a Request object.
 */
export async function resolveTenant(request) {
  const shopDomain = request.headers.get('x-shop-domain');
  if (!shopDomain) throw new Error('Missing x-shop-domain header');

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, shop_domain')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) throw new Error(`Tenant not found for domain: ${shopDomain}`);

  return { tenantId: data.id, shopDomain: data.shop_domain };
}

/**
 * getTenantId(request)
 * For use in API routes.
 * Falls back to NEXT_PUBLIC_DEV_SHOP_DOMAIN in development.
 * REMOVE the fallback before going to production.
 */
export async function getTenantId(request) {
 const shopDomain =
  request.headers.get('x-shop-domain') || devShop();

  if (!shopDomain) throw new Error('Missing x-shop-domain header');

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) throw new Error(`Tenant not found for domain: ${shopDomain}`);

  return data.id;
}

/**
 * getTenantIdFromHeaders(headersList)
 * For use in server components — reads from Next.js headers() result.
 * Falls back to NEXT_PUBLIC_DEV_SHOP_DOMAIN in development.
 * REMOVE the fallback before going to production.
 */
export async function getTenantIdFromHeaders(headersList) {
  const shopDomain =
  headersList.get('x-shop-domain') || devShop();

  if (!shopDomain) throw new Error('Missing x-shop-domain header');

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) throw new Error(`Tenant not found for domain: ${shopDomain}`);

  return data.id;
}

/**
 * getTenantFromHeaders(headersList)
 * For use in server components that need both tenantId and shopDomain.
 * Returns { tenantId, shopDomain }.
 * Falls back to NEXT_PUBLIC_DEV_SHOP_DOMAIN in development.
 * REMOVE the fallback before going to production.
 */
export async function getTenantFromHeaders(headersList) {
  const shopDomain =
    headersList.get('x-shop-domain') || devShop();

  if (!shopDomain) throw new Error('Missing x-shop-domain header');

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, shop_domain')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) throw new Error(`Tenant not found for domain: ${shopDomain}`);

  return { tenantId: data.id, shopDomain: data.shop_domain };
}
