// /src/lib/logPOActivity.js
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readUserCookie } from '@/lib/shopify/userCookie';
import { userLabel } from '@/lib/userLabel';
import { logError } from '@/lib/logError';

/**
 * Logs an activity entry for a purchase order.
 * Never throws — failures are logged to console only so they don't break the parent operation.
 *
 * @param {object} params
 * @param {string} params.poId
 * @param {string} params.tenantId
 * @param {'created'|'edited'|'released'|'resent'|'received'|'acknowledged'|'cancelled'|'closed'|'error'|'sftp_uploaded'|'sftp_retrieved'|'sftp_deleted'|'sftp_failed'|'ship_file_retrieved'|'ship_file_failed'|'reminder_sent'} params.action
 * @param {string} [params.comments]   Notes shown in the History table
 * @param {Request} [params.request]   The incoming request; used to record which user acted
 * @param {string} [params.userName]   Overrides the user (e.g. "System" for automatic checks)
 */
export async function logPOActivity({ poId, tenantId, action, comments, request, userName }) {
  try {
    let user = userName ? { name: userName, id: null } : (request ? readUserCookie(request) : null);
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
    const { error } = await supabase
      .from('po_activity_log')
      .insert({
        po_id:      poId,
        tenant_id:  tenantId,
        action,
        comments:   comments ?? null,
        user_name:  user?.name ?? null,
        user_id:    user?.id ?? null,
        created_at: new Date().toISOString(),
      });
    if (error) {
      console.error('[logPOActivity] insert error:', error);
      // Show it on the Errors page too, so a History row that didn't save is never silent
      await logError({ source: 'logPOActivity', error: new Error(`History row "${action}" was not saved: ${error.message}`), tenantId, context: { poId, action } });
    }
  } catch (err) {
    console.error('[logPOActivity] unexpected error:', err);
  }
}
