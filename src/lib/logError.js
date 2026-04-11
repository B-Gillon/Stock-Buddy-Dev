/**
 * logError.js
 * Central error logging helper. Call this anywhere in the app when an error occurs.
 * Writes to the error_log table in Supabase.
 *
 * Usage:
 *   import { logError } from '@/lib/logError';
 *   await logError({ source: 'syncProducts', error: err, tenantId, context: { poId } });
 */

import { supabase } from '@/lib/supabaseClient';

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

    await supabase.from('error_log').insert({
      tenant_id: tenantId,
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
