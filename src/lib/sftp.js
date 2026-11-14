// /src/lib/sftp.js
// SFTP delivery of PO files to a supplier, plus status tracking of the delivered files.
// Server-side only.
import SftpClient from 'ssh2-sftp-client';
import { supabase } from '@/lib/supabaseClient';
import { logPOActivity } from '@/lib/logPOActivity';

// ── Validation helpers ────────────────────────────────────────────────────────

const PRIVATE_HOST = /^(localhost$|.*\.local$|.*\.internal$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:|\[?fe80:)/i;

/** Returns an error message, or null when the host looks acceptable. */
export function validateSftpHost(host) {
  const h = String(host ?? '').trim();
  if (!h) return 'SFTP host is required.';
  if (/[\s/\\@]/.test(h) || h.includes('://')) return 'Enter just the host name, e.g. sftp.supplier.com.';
  if (PRIVATE_HOST.test(h)) return 'Private, local and internal addresses are not allowed.';
  return null;
}

/** Cleans a remote directory path. Empty means the login directory. */
export function cleanRemoteDir(dir) {
  const d = String(dir ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (d.includes('\0') || d.split('/').includes('..')) throw new Error('Paths cannot contain "..".');
  return d;
}

const remotePath = (dir, name) => (dir ? `${dir}/${name}` : name);

// ── Connection ────────────────────────────────────────────────────────────────

function friendlyError(err, pinned) {
  const msg = String(err?.message ?? err);
  if (pinned && /host denied|verification failed|handshake failed/i.test(msg)) {
    return "The SFTP server's host key has changed since it was first trusted. If that is expected, use 'Reset host key' in the supplier's Transmission settings.";
  }
  if (/authentication|all configured authentication methods failed/i.test(msg)) return 'SFTP login failed: check the username and password or key.';
  if (/ENOTFOUND|getaddrinfo/i.test(msg)) return 'SFTP host name could not be found.';
  if (/ETIMEDOUT|timed out|timeout/i.test(msg)) return 'Timed out connecting to the SFTP server.';
  if (/ECONNREFUSED/i.test(msg)) return 'The SFTP server refused the connection (check the host and port).';
  return msg;
}

/**
 * Connects, runs fn(client), always disconnects.
 * The server's host key is pinned on the first successful connection and verified afterwards.
 */
async function withSftp(settings, fn) {
  const client = new SftpClient();
  const pinned = settings.sftp_host_fingerprint || null;
  let seen = null;

  // Some servers only accept the password through a "keyboard-interactive" prompt
  // (FileZilla handles this automatically), so answer that prompt with the same password.
  if (settings.sftp_password) {
    client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      finish(prompts.map(() => settings.sftp_password));
    });
  }

  try {
    await client.connect({
      host: settings.sftp_host,
      port: Number(settings.sftp_port) || 22,
      username: settings.sftp_username,
      password: settings.sftp_password || undefined,
      privateKey: settings.sftp_private_key || undefined,
      tryKeyboard: !!settings.sftp_password,
      readyTimeout: 15000,
      hostHash: 'sha256',
      hostVerifier: (hash) => { seen = hash; return pinned ? hash === pinned : true; },
    });
  } catch (err) {
    throw new Error(friendlyError(err, !!pinned));
  }

  try {
    if (!pinned && seen && settings.supplier_id) {
      await supabase
        .from('supplier_transmission_settings')
        .update({ sftp_host_fingerprint: seen })
        .eq('supplier_id', settings.supplier_id);
    }
    return await fn(client, seen ?? pinned);
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Test connection ───────────────────────────────────────────────────────────

export async function testSftpConnection(settings) {
  return withSftp(settings, async (client, fingerprint) => {
    const checks = [];
    const targets = [
      ['PDF folder', settings.sftp_send_pdf, settings.sftp_pdf_path],
      ['CSV folder', settings.sftp_send_csv, settings.sftp_csv_path],
    ].filter(([, enabled]) => enabled);

    for (const [label, , path] of targets) {
      const dir = cleanRemoteDir(path) || '.';
      const kind = await client.exists(dir);
      checks.push({
        label, path: dir,
        ok: kind === 'd',
        message: kind === 'd' ? 'Found' : kind ? 'Exists but is not a folder' : 'Folder not found',
      });
    }
    return { ok: checks.every((c) => c.ok), fingerprint, checks };
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** Picks a file name that is not already on the server: name.pdf, name_2.pdf, name_3.pdf ... */
async function uniqueRemoteName(client, dir, name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  for (let n = 2; await client.exists(remotePath(dir, candidate)); n++) {
    if (n > 999) throw new Error('Too many files with this name already exist on the SFTP site.');
    candidate = `${stem}_${n}${ext}`;
  }
  return candidate;
}

/**
 * Uploads PO files. Each file is written under a temporary name and renamed, so the
 * supplier's system never picks up a half-written file, then the size is verified.
 *
 * @param {object} settings  from getTransmissionSettings(id, { withSecrets: true })
 * @param {{type:'pdf'|'csv', name:string, buffer:Buffer}[]} files
 * @returns {Promise<{ok:boolean, files:object[], notes:string, error?:string}>}
 */
export async function uploadPOFiles(settings, files, { poId, tenantId, supplierId }) {
  const results = [];
  const now = () => new Date().toISOString();

  const record = async (r) => {
    await supabase.from('po_sftp_transmissions').insert({
      tenant_id: tenantId, po_id: poId, supplier_id: supplierId,
      file_type: r.type, file_name: r.name, remote_dir: r.dir,
      size_bytes: r.size ?? null,
      status: r.ok ? 'uploaded' : 'failed',
      uploaded_at: r.ok ? now() : null,
      last_checked_at: r.ok ? now() : null,
      error: r.ok ? null : r.error,
    });
  };

  try {
    await withSftp(settings, async (client) => {
      for (const f of files) {
        const dir = cleanRemoteDir(f.type === 'pdf' ? settings.sftp_pdf_path : settings.sftp_csv_path);
        const r = { type: f.type, name: f.name, dir, size: f.buffer.length, ok: false };
        let tmpPath = null;
        try {
          // Never overwrite: if the name is taken, add _2, _3, ... before the extension.
          // A name whose file the supplier already removed is free to use again.
          const name = await uniqueRemoteName(client, dir, f.name);
          r.name = name;
          const finalPath = remotePath(dir, name);
          tmpPath = `${finalPath}.tmp`;
          await client.put(f.buffer, tmpPath);
          await client.rename(tmpPath, finalPath);
          const st = await client.stat(finalPath);
          if (Number(st.size) !== f.buffer.length) {
            throw new Error(`Size check failed (sent ${f.buffer.length} bytes, server shows ${st.size}).`);
          }
          r.ok = true;
        } catch (err) {
          r.error = String(err?.message ?? err);
          if (tmpPath) await client.delete(tmpPath).catch(() => {});
        }
        results.push(r);
      }
    });
  } catch (err) {
    // Could not connect at all: every file failed.
    const msg = String(err?.message ?? err);
    for (const f of files) {
      if (!results.find((r) => r.name === f.name && r.type === f.type)) {
        results.push({ type: f.type, name: f.name, dir: cleanRemoteDir(f.type === 'pdf' ? settings.sftp_pdf_path : settings.sftp_csv_path), size: f.buffer.length, ok: false, error: msg });
      }
    }
  }

  for (const r of results) await record(r).catch((e) => console.error('[sftp] record failed:', e.message));

  const label = (t) => t.toUpperCase();
  const notes = results
    .map((r) => r.ok
      ? `${label(r.type)} uploaded to ${settings.sftp_host}:${remotePath(r.dir, r.name)} (${r.size.toLocaleString()} bytes, verified)`
      : `${label(r.type)} failed: ${r.error}`)
    .join('; ');

  return { ok: results.every((r) => r.ok), files: results, notes };
}

/** Writes the History rows for an upload attempt. */
export async function logSftpUpload({ poId, tenantId, request, sftp }) {
  const okFiles = sftp.files.filter((f) => f.ok);
  const badFiles = sftp.files.filter((f) => !f.ok);
  const describe = (list) => list.map((r) => (r.ok
    ? `${r.type.toUpperCase()} ${r.name} → ${r.dir || '(login folder)'}`
    : `${r.type.toUpperCase()} ${r.name}: ${r.error}`)).join('; ');

  if (okFiles.length) await logPOActivity({ poId, tenantId, request, action: 'sftp_uploaded', comments: describe(okFiles) });
  if (badFiles.length) await logPOActivity({ poId, tenantId, request, action: 'sftp_failed', comments: describe(badFiles) });
}

// ── Status tracking ───────────────────────────────────────────────────────────

/**
 * Checks the files we put on the supplier's SFTP site for this PO and records what happened:
 *   • file gone            → "deleted" (the supplier's system picked it up and/or removed it)
 *   • access time moved    → "retrieved" (best effort: only some servers keep access times)
 * SFTP has no standard "downloaded" event, so these are the signals the server gives us.
 */
export async function refreshSftpStatus({ poId, tenantId, settings }) {
  const { data: open } = await supabase
    .from('po_sftp_transmissions')
    .select('*')
    .eq('po_id', poId)
    .eq('tenant_id', tenantId)
    .in('status', ['uploaded', 'retrieved']);

  if (!open || open.length === 0) return { checked: 0, retrieved: 0, deleted: 0 };

  const retrieved = [];
  const deleted = [];
  const now = new Date().toISOString();

  await withSftp(settings, async (client) => {
    for (const row of open) {
      const path = remotePath(row.remote_dir, row.file_name);
      const kind = await client.exists(path);

      if (!kind) {
        await supabase.from('po_sftp_transmissions')
          .update({ status: 'deleted', deleted_at: now, last_checked_at: now }).eq('id', row.id);
        deleted.push(row);
        continue;
      }

      let update = { last_checked_at: now };
      if (row.status === 'uploaded') {
        const st = await client.stat(path);
        if (st.accessTime && st.modifyTime && st.accessTime - st.modifyTime > 5000) {
          update = { ...update, status: 'retrieved', retrieved_at: now };
          retrieved.push(row);
        }
      }
      await supabase.from('po_sftp_transmissions').update(update).eq('id', row.id);
    }
  });

  const names = (rows) => [...new Set(rows.map((r) => `${r.file_type.toUpperCase()} ${r.file_name}`))].join('; ');
  if (retrieved.length) {
    await logPOActivity({ poId, tenantId, userName: 'System', action: 'sftp_retrieved',
      comments: `${names(retrieved)} (server access time changed after upload)` });
  }
  if (deleted.length) {
    await logPOActivity({ poId, tenantId, userName: 'System', action: 'sftp_deleted',
      comments: `${names(deleted)} no longer on the SFTP site (removed by the supplier's system)` });
  }

  return { checked: open.length, retrieved: retrieved.length, deleted: deleted.length };
}


/**
 * Hourly sweep: looks at every file still being tracked, across all suppliers, and records
 * the ones that are gone. Each supplier's SFTP site is opened once. Nothing is written to a
 * PO's History unless something changed.
 */
export async function refreshAllSftpStatus() {
  const { getTransmissionSettings } = await import('@/lib/transmissionSettings');
  const { data: open } = await supabase
    .from('po_sftp_transmissions')
    .select('po_id, tenant_id, supplier_id')
    .in('status', ['uploaded', 'retrieved']);

  const groups = new Map();
  for (const r of open ?? []) groups.set(`${r.supplier_id}|${r.po_id}`, r);

  const bySupplier = new Map();
  for (const g of groups.values()) {
    if (!bySupplier.has(g.supplier_id)) bySupplier.set(g.supplier_id, []);
    bySupplier.get(g.supplier_id).push(g);
  }

  const summary = { suppliers: bySupplier.size, pos: groups.size, retrieved: 0, deleted: 0, failed: 0 };
  for (const [supplierId, pos] of bySupplier) {
    try {
      const settings = await getTransmissionSettings(supplierId, { withSecrets: true });
      if (!settings.sftp_enabled) continue;
      for (const g of pos) {
        const res = await refreshSftpStatus({ poId: g.po_id, tenantId: g.tenant_id, settings });
        summary.retrieved += res.retrieved;
        summary.deleted += res.deleted;
      }
    } catch (err) {
      summary.failed += 1;
      console.error(`[sftp] sweep failed for supplier ${supplierId}:`, err.message);
    }
  }
  return summary;
}
