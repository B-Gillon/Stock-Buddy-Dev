// /src/lib/shipFilePickup.js
// Picks up a supplier's shipment files from their SFTP pickup folder and creates the shipments, using the
// same checks as the supplier's manual upload. All-or-nothing per file: a file with any problem creates
// nothing. Files are never changed or deleted on the supplier's server; a file is skipped once it has been
// handled (same name, size and modified time), and picked up again only if the supplier replaces it.
// A file that shipped successfully is deleted from the SFTP site afterwards; a file with problems is left there.
// Server-side only.
import { supabase } from '@/lib/supabaseClient';
import { getShipmentSftpSettings } from '@/lib/shipmentSftpSettings';
import { fetchShipFiles, deleteShipFiles, validateSftpHost } from '@/lib/sftp';
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
    await sendAlert({ tenantId, supplierId, kind: 'ship_file_failed',
      vars: { supplier_name: supplier.supplier_name, file_name: '(could not connect to the SFTP site)', po_numbers: 'n/a', skus: '', problem: err.message } });
    return { ok: false, error: err.message, files: [] };
  }

  const results = [];
  const shippedFiles = [];
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
      await sendAlert({ tenantId, supplierId, kind: 'ship_file_failed',
        vars: { supplier_name: supplier.supplier_name, file_name: f.name, po_numbers: poNumbers.join(', ') || 'none found', skus: [...new Set((plan?.rows ?? []).map((r) => r.v.sku).filter(Boolean))].join(', '), problem: message } });
    }
    results.push({ name: f.name, status, message, shipments: created });
    if (status === 'shipped') shippedFiles.push(f);
  }

  // Delete what shipped, so the next pickup doesn't see it again
  if (shippedFiles.length) {
    const deleted = await deleteShipFiles(s, shippedFiles);
    for (const f of shippedFiles) {
      const r = results.find((x) => x.name === f.name);
      const note = deleted[f.name] == null ? 'File deleted from the SFTP site.' : `Could not delete the file from the SFTP site: ${deleted[f.name]}`;
      r.message = `${r.message}\n${note}`;
      await supabase.from('ship_file_pickups').update({ message: r.message })
        .match({ supplier_id: supplierId, file_name: f.name, file_size: f.size, file_mtime: f.mtime.toISOString() });
    }
  }
  return { ok: true, files: results };
}
