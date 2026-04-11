// /src/lib/logPOActivity.js
import { supabase } from '@/lib/supabaseClient';

/**
 * Logs an activity entry for a purchase order.
 * Never throws — failures are logged to console only so they don't break the parent operation.
 *
 * @param {object} params
 * @param {string} params.poId
 * @param {string} params.tenantId
 * @param {'created'|'edited'|'released'|'resent'|'cancelled'|'closed'} params.action
 * @param {string} [params.comments]
 */
export async function logPOActivity({ poId, tenantId, action, comments }) {
  try {
    const { error } = await supabase
      .from('po_activity_log')
      .insert({
        po_id:      poId,
        tenant_id:  tenantId,
        action,
        comments:   comments ?? null,
        created_at: new Date().toISOString(),
      });
    if (error) console.error('[logPOActivity] insert error:', error);
  } catch (err) {
    console.error('[logPOActivity] unexpected error:', err);
  }
}
