/**
 * logError.js
 * Central error logging helper. Call this anywhere in the app when an error occurs.
 * Writes to the error_log table in Supabase.
 *
 * Usage:
 *   import { logError } from '@/lib/logError';
 *   await logError({ source: 'syncProducts', error: err, tenantId, context: { poId } });
 */

import { headers } from 'next/headers';
import { supabase } from '@/lib/supabaseClient';
import { resolveActingUser } from '@/lib/actingUser';

/**
 * @param {object} opts
 * @param {string}      opts.source    - where the error came from, e.g. 'syncProducts', 'releasePO', 'api/purchase-orders'
 * @param {Error|string} opts.error    - the error object or message string
 * @param {string}      [opts.tenantId] - tenant UUID if available
 * @param {object}      [opts.context] - any additional context (poId, variantId, etc.)
 */
export async function logError({ source, error, tenantId = null, context = null }) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack   = error instanceof Error ? error.stack   : null;

    // Who was signed in when it happened, if this ran inside a request (not for cron / background work)
    let userName = null;
    try { userName = (await resolveActingUser({ headers: await headers() }))?.name ?? null; } catch { /* outside a request */ }

    await supabase.from('error_log').insert({
      tenant_id: tenantId,
      user_name: userName,
      source,
      message,
      stack,
      context,
    });
  } catch (loggingError) {
    // Never let logging failures crash the app — just console.error
    console.error('Failed to write to error_log:', loggingError);
  }
}
