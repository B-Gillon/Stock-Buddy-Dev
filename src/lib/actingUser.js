// /src/lib/actingUser.js
// Who is making the current request: a Shopify staff user (signed cookie or verified session token) or a
// signed-in website user. Works with anything that has `headers` (and optionally `cookies`), such as a Request.
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readUserCookie } from '@/lib/shopify/userCookie';
import { userLabel } from '@/lib/userLabel';

/** @returns {Promise<{name:string, id:string|null}|null>} */
export async function resolveActingUser(request) {
  let user = request ? readUserCookie(request) : null;
  // Shopify staff user known only from the verified session token (no cookie available)
  const shopifyUserId = !user && request?.headers?.get?.('x-shopify-user-id');
  const shopDomain = request?.headers?.get?.('x-shop-domain');
  if (shopifyUserId && shopDomain) {
    const { data: su } = await supabaseAdmin.from('shop_users').select('name').eq('shop_domain', shopDomain).eq('user_id', shopifyUserId).maybeSingle();
    if (su?.name) user = { name: su.name, id: shopifyUserId };
  }
  // A website (non-Shopify) user: use their username
  const webUserId = !user && request?.headers?.get?.('x-auth-user');
  if (webUserId) {
    const { data: u } = await supabase.from('app_users').select('email, username').eq('id', webUserId).maybeSingle();
    if (u) user = { name: userLabel(u), id: null };
  }
  return user;
}
