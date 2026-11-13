// /src/lib/logPOActivity.js
import { supabase } from '@/lib/supabaseClient';
import { readUserCookie } from '@/lib/shopify/userCookie';

/**
 * Logs an activity entry for a purchase order.
 * Never throws — failures are logged to console only so they don't break the parent operation.
 *
 * @param {object} params
 * @param {string} params.poId
 * @param {string} params.tenantId
 * @param {'created'|'edited'|'released'|'resent'|'received'|'acknowledged'|'cancelled'|'closed'|'error'} params.action
 * @param {string} [params.comments]   Notes shown in the History table
 * @param {Request} [params.request]   The incoming request; used to record which user acted
 */
export async function logPOActivity({ poId, tenantId, action, comments, request }) {
  try {
    const user = request ? readUserCookie(request) : null;
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
    if (error) console.error('[logPOActivity] insert error:', error);
  } catch (err) {
    console.error('[logPOActivity] unexpected error:', err);
  }
}
