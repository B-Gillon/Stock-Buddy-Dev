// /src/lib/shipFilePickup.js
// Picks up a supplier's shipment files from their SFTP pickup folder and creates the shipments, using the
// same checks as the supplier's manual upload. All-or-nothing per file: a file with any problem creates
// nothing. Every file found is processed, and once it has been read it is deleted from the SFTP site, so it
// is not picked up again. A file that could not be read is left there. A file that is somehow still there on
// the next pickup is simply checked again: its carton IDs and lots are already used, so it can't ship twice.
// Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { getShipmentSftpSettings } from '@/lib/shipmentSftpSettings';
import { fetchShipFiles, deleteShipFiles, validateSftpHost } from '@/lib/sftp';
import { buildImportPlan, commitImportPlan } from '@/lib/shipmentImport';
import { logPOActivity } from '@/lib/logPOActivity';
import { sendAlert } from '@/lib/alerts';
import { logError } from '@/lib/logError';

const low = (s) => String(s ?? '').trim().toLowerCase();

// Every problem, by row, so nothing is hidden behind "and N more"
function problemSummary(plan) {
  if (plan.fatal) return plan.fatal;
  const list = [...(plan.errors ?? [])].sort((a, b) => a.n - b.n).map((e) => `Row ${e.n}: ${e.message}`);
  return list.length ? list.join('\n') : 'The file has no shipments to create.';
}

/** @returns {Promise<{ok:boolean, error?:string, files:{name:string, status:'shipped'|'failed', message:string, shipments?:string[]}[]}>} */
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
    await logError({ source: 'shipFilePickup/connect', error: new Error(`Could not check ${supplier.supplier_name}'s SFTP site for ship files: ${err.message}`), tenantId, context: { supplierId } });
    await sendAlert({ tenantId, supplierId, kind: 'ship_file_failed',
      vars: { supplier_name: supplier.supplier_name, file_name: '(could not connect to the SFTP site)', po_numbers: 'n/a', skus: '', problem: err.message } });
    return { ok: false, error: err.message, files: [] };
  }

  const results = [];
  const readFiles = [];
  for (const f of found) {
    const sig = { supplier_id: supplierId, file_name: f.name, file_size: f.size, file_mtime: f.mtime.toISOString() };
    const record = (status, message, poNumbers, created) => supabase.from('ship_file_pickups').insert({
      tenant_id: tenantId, ...sig, status, message, po_numbers: poNumbers, shipments_created: created, picked_up_by: userName,
    });

    let plan = null, status = 'failed', message = '', created = [], poNumbers = [];
    if (f.error) message = f.error;
    else {
      try {
        plan = await buildImportPlan({ tenantId, supplierId, fileText: f.text, maxErrors: Infinity });
        poNumbers = [...new Set([...(plan.rows ?? []).map((r) => r.v.po_number), ...(plan.groups ?? []).map((g) => g.poNumber)].filter(Boolean))];
        if (plan.ok) {
          const r = await commitImportPlan({ tenantId, supplierId, userName, plan, logActivity: false });
          created = r.created ?? [];
          if (r.ok) { status = 'shipped'; message = `${created.length} shipment${created.length === 1 ? '' : 's'} created: ${created.join(', ')}`; }
          else message = `${r.error}${created.length ? ` (already created before the error: ${created.join(', ')})` : ''}`;
        } else message = problemSummary(plan);
      } catch (err) { message = `Something went wrong reading the file: ${err.message}`; }
    }

    // One History row per PO the file mentions: Ship File Upload (shipped) or Ship File Error (nothing created)
    if (poNumbers.length) {
      const { data: pos } = await supabase.from('purchase_orders').select('id, po_number').eq('tenant_id', tenantId).eq('supplier_id', supplierId).in('po_number', poNumbers);
      const known = new Map((pos ?? []).map((p) => [low(p.po_number), p]));
      for (const n of poNumbers) {
        const po = known.get(low(n));
        if (!po) continue;
        if (status === 'shipped') {
          const mine = created.filter((c) => c.startsWith(`${po.po_number}-`));
          await logPOActivity({ poId: po.id, tenantId, userName, action: 'ship_file_upload', comments: `${f.name}: ${mine.length === 1 ? 'shipment' : 'shipments'} ${mine.join(', ')} created` });
        } else {
          await logPOActivity({ poId: po.id, tenantId, userName, action: 'ship_file_error', comments: `${f.name}: ${message.split('\n')[0]}` });
        }
      }
    }

    await record(status, message, poNumbers, created.length);
    if (status === 'failed') {
      await logError({ source: 'shipFilePickup/file', error: new Error(`Ship file ${f.name} from ${supplier.supplier_name} could not be processed:\n${message}`), tenantId, context: { supplierId, file: f.name, pos: poNumbers } });
      await sendAlert({ tenantId, supplierId, kind: 'ship_file_failed',
        vars: { supplier_name: supplier.supplier_name, file_name: f.name, po_numbers: poNumbers.join(', ') || 'none found', skus: [...new Set((plan?.rows ?? []).map((r) => r.v.sku).filter(Boolean))].join(', '), problem: message },
        // The file is deleted from the SFTP site afterwards, so the email carries the copy
        attachments: f.text !== undefined ? [{ filename: f.name, content: f.text, contentType: 'text/csv' }] : undefined });
    }
    results.push({ name: f.name, status, message, shipments: created });
    if (f.text !== undefined) readFiles.push(f);
  }

  // Delete what was read, so the next pickup doesn't see it again
  if (readFiles.length) {
    const deleted = await deleteShipFiles(s, readFiles);
    for (const f of readFiles) {
      const r = results.find((x) => x.name === f.name);
      const note = deleted[f.name] == null ? 'File deleted from the SFTP site.' : `Could not delete the file from the SFTP site: ${deleted[f.name]}`;
      r.message = `${r.message}\n${note}`;
      await supabase.from('ship_file_pickups').update({ message: r.message })
        .match({ supplier_id: supplierId, file_name: f.name, file_size: f.size, file_mtime: f.mtime.toISOString() });
    }
  }
  return { ok: true, files: results };
}

/** Scheduled run: every supplier (all stores) that has SFTP Shipments turned on. */
export async function pickupAllShipFiles() {
  const { data: rows } = await supabase.from('supplier_shipment_sftp_settings').select('tenant_id, supplier_id').eq('sftp_enabled', true);
  const sum = { suppliers: (rows ?? []).length, files: 0, shipped: 0, failed: 0, couldNotConnect: 0 };
  for (const r of rows ?? []) {
    try {
      const res = await pickupShipFiles({ tenantId: r.tenant_id, supplierId: r.supplier_id });
      if (!res.ok) { sum.couldNotConnect += 1; continue; }
      for (const f of res.files) { sum.files += 1; if (f.status === 'shipped') sum.shipped += 1; else sum.failed += 1; }
    } catch (err) {
      sum.couldNotConnect += 1;
      await logError({ source: 'shipFilePickup/scheduled', error: err, tenantId: r.tenant_id, context: { supplierId: r.supplier_id } });
    }
  }
  return sum;
}
