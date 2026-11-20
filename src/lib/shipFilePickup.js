// /src/lib/shipFilePickup.js
// Picks up a supplier's shipment files from their SFTP pickup folder and creates the shipments, using the
// same checks as the supplier's manual upload. All-or-nothing per file: a file with any problem creates
// nothing. Files are never changed or deleted on the supplier's server; a file is skipped once it has been
// handled (same name, size and modified time), and picked up again only if the supplier replaces it.
// Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { getShipmentSftpSettings } from '@/lib/shipmentSftpSettings';
import { fetchShipFiles, validateSftpHost } from '@/lib/sftp';
import { buildImportPlan, commitImportPlan } from '@/lib/shipmentImport';
import { logPOActivity } from '@/lib/logPOActivity';
import { sendAlert } from '@/lib/alerts';

const low = (s) => String(s ?? '').trim().toLowerCase();

function problemSummary(plan, max = 8) {
  if (plan.fatal) return plan.fatal;
  const list = (plan.errors ?? []).slice(0, max).map((e) => `Row ${e.n}: ${e.message}`);
  const total = plan.errorCount ?? (plan.errors ?? []).length;
  if (!list.length) return 'The file has no shipments to create.';
  return list.join('\n') + (total > list.length ? `\n…and ${total - list.length} more problem${total - list.length === 1 ? '' : 's'}.` : '');
}

/** @returns {Promise<{ok:boolean, error?:string, files:{name:string, status:'shipped'|'failed'|'skipped', message:string, shipments?:string[]}[]}>} */
export async function pickupShipFiles({ tenantId, supplierId, userName = 'System' }) {
  const { data: supplier } = await supabase.from('suppliers').select('id, supplier_name').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  if (!supplier) return { ok: false, error: 'Supplier not found.', files: [] };

  const s = await getShipmentSftpSettings(supplierId, { withSecrets: true });
  if (!s.sftp_enabled) return { ok: false, error: 'SFTP Shipments is not enabled for this supplier.', files: [] };
  if (!(s.sftp_host && s.sftp_username && (s.sftp_password || s.sftp_private_key) && s.sftp_folder)) {
    return { ok: false, error: 'Save the host, username, password or key, and pickup folder first.', files: [] };
  }
  const hostError = validateSftpHost(s.sftp_host);
  if (hostError) return { ok: false, error: hostError, files: [] };

  let found;
  try { found = await fetchShipFiles(s); }
  catch (err) {
    await sendAlert({ tenantId, kind: 'ship_file_failed', subject: `Could not check ${supplier.supplier_name}'s SFTP site for ship files`,
      lines: [`Supplier: ${supplier.supplier_name}`, `Problem: ${err.message}`] });
    return { ok: false, error: err.message, files: [] };
  }

  const results = [];
  for (const f of found) {
    const sig = { supplier_id: supplierId, file_name: f.name, file_size: f.size, file_mtime: f.mtime.toISOString() };
    const { data: seen } = await supabase.from('ship_file_pickups').select('id, status').match(sig).limit(1);
    if (seen?.length) { results.push({ name: f.name, status: 'skipped', message: `Already handled (${seen[0].status === 'shipped' ? 'shipped' : 'failed'}).` }); continue; }

    const record = (status, message, poNumbers, created) => supabase.from('ship_file_pickups').insert({
      tenant_id: tenantId, ...sig, status, message, po_numbers: poNumbers, shipments_created: created, picked_up_by: userName,
    });

    let plan = null, status = 'failed', message = '', created = [], poNumbers = [];
    if (f.error) message = f.error;
    else {
      try {
        plan = await buildImportPlan({ tenantId, supplierId, fileText: f.text });
        poNumbers = [...new Set([...(plan.rows ?? []).map((r) => r.v.po_number), ...(plan.groups ?? []).map((g) => g.poNumber)].filter(Boolean))];
        if (plan.ok) {
          const r = await commitImportPlan({ tenantId, supplierId, userName, plan });
          created = r.created ?? [];
          if (r.ok) { status = 'shipped'; message = `${created.length} shipment${created.length === 1 ? '' : 's'} created: ${created.join(', ')}`; }
          else message = `${r.error}${created.length ? ` (already created before the error: ${created.join(', ')})` : ''}`;
        } else message = problemSummary(plan);
      } catch (err) { message = `Something went wrong reading the file: ${err.message}`; }
    }

    // History on every PO the file mentions
    if (poNumbers.length) {
      const { data: pos } = await supabase.from('purchase_orders').select('id, po_number').eq('tenant_id', tenantId).eq('supplier_id', supplierId).in('po_number', poNumbers);
      const known = new Map((pos ?? []).map((p) => [low(p.po_number), p.id]));
      for (const n of poNumbers) {
        const poId = known.get(low(n));
        if (!poId) continue;
        await logPOActivity({ poId, tenantId, userName, action: 'ship_file_retrieved', comments: `${f.name} picked up from SFTP` });
        if (status === 'failed') await logPOActivity({ poId, tenantId, userName, action: 'ship_file_failed', comments: `${f.name}: ${message.split('\n')[0]}` });
      }
    }

    await record(status, message, poNumbers, created.length);
    if (status === 'failed') {
      await sendAlert({ tenantId, kind: 'ship_file_failed', subject: `Ship file ${f.name} from ${supplier.supplier_name} could not be processed`,
        lines: [`Supplier: ${supplier.supplier_name}`, `File: ${f.name}`, poNumbers.length ? `POs in the file: ${poNumbers.join(', ')}` : '', 'No shipments were created from this file.', '', 'What went wrong:', message,
          '', 'Ask the supplier to correct the file and upload it again.'].filter((l, i, a) => l !== '' || a[i - 1] !== '') });
    }
    results.push({ name: f.name, status, message, shipments: created });
  }
  return { ok: true, files: results };
}
