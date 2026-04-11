/**
 * reconcileShopifyDeltas.js
 *
 * Reconciles Shopify inventory_levels.available deltas against SB state.
 *
 * Case A: SB pushed the change → no action needed
 * Case B: SB did NOT push it → external receiving → reduce incoming_remaining,
 *         auto-switch to external
 * Case C: Shopify available decreased → log discrepancy for merchant review
 *
 * This function is the higher-level orchestrator — it calls
 * detectExternalReceiving under the hood and handles all three cases.
 *
 * It is intended to be called on a scheduled basis (cron/webhook).
 */

import { supabase } from "@/lib/supabaseClient";
import { detectExternalReceiving } from "./detectExternalReceiving";

/**
 * Reconcile Shopify inventory deltas for all active POs.
 *
 * @param {string|null} tenantId - Scope to one tenant, or null for all
 * @returns {Promise<ReconcileReport>}
 */
export async function reconcileShopifyDeltas(tenantId = null) {
  const startedAt = new Date().toISOString();
  let totalPOs = 0;
  let externalSwitches = 0;
  let errors = [];

  try {
    const results = await detectExternalReceiving(tenantId);

    totalPOs = results.length;

    for (const result of results) {
      if (result.error) {
        errors.push({ poId: result.poId, error: result.error });
        continue;
      }
      if (result.switchedToExternal) {
        externalSwitches++;
        console.info(
          `[Stock Buddy Reconcile] PO ${result.poId} switched to external. ` +
            `Lines with external receiving: ${result.detectedLines}`
        );
      }
    }
  } catch (err) {
    errors.push({ global: true, error: err.message });
  }

  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    totalPOsChecked: totalPOs,
    externalSwitches,
    errors,
  };

  // Optionally log to sync_status
  if (tenantId) {
    await supabase.from("sync_status").upsert(
      {
        tenant_id: tenantId,
        sync_type: "po_reconcile",
        last_synced_at: report.completedAt,
      },
      { onConflict: "tenant_id,sync_type" }
    );
  }

  return report;
}
