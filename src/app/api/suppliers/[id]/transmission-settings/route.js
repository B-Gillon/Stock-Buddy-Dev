// /src/app/api/suppliers/[id]/transmission-settings/route.js
// File naming + SFTP settings for a supplier. Passwords / private keys are write-only:
// they are encrypted on save and never sent back to the browser.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { getTransmissionSettings } from '@/lib/transmissionSettings';
import { validateFileNamePattern, DEFAULT_FILE_NAME_PATTERN } from '@/lib/poFileName';
import { encryptSecret } from '@/lib/secretBox';
import { validateSftpHost, cleanRemoteDir } from '@/lib/sftp';

async function assertSupplier(supplierId, tenantId) {
  const { data } = await supabase
    .from('suppliers').select('id').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const s = await getTransmissionSettings(id);
    return NextResponse.json({
      settings: {
        file_name_pattern: s.file_name_pattern ?? DEFAULT_FILE_NAME_PATTERN,
        sftp_enabled:  !!s.sftp_enabled,
        sftp_host:     s.sftp_host ?? '',
        sftp_port:     s.sftp_port ?? 22,
        sftp_username: s.sftp_username ?? '',
        sftp_send_pdf: s.sftp_send_pdf ?? true,
        sftp_send_csv: s.sftp_send_csv ?? true,
        sftp_pdf_path: s.sftp_pdf_path ?? '',
        sftp_csv_path: s.sftp_csv_path ?? '',
        has_password:    s.has_password,
        has_private_key: s.has_private_key,
        host_fingerprint: s.sftp_host_fingerprint ?? null,
      },
    });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/transmission-settings/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const b = await request.json();

    const naming = validateFileNamePattern(b.file_name_pattern);
    if (!naming.ok) return NextResponse.json({ error: naming.error }, { status: 422 });

    const { data: existing } = await supabase
      .from('supplier_transmission_settings').select('*').eq('supplier_id', id).maybeSingle();

    const row = {
      tenant_id: tenantId,
      supplier_id: id,
      file_name_pattern: String(b.file_name_pattern).trim(),
      sftp_enabled: !!b.sftp_enabled,
      sftp_send_pdf: b.sftp_send_pdf !== false,
      sftp_send_csv: b.sftp_send_csv !== false,
      updated_at: new Date().toISOString(),
    };

    // SFTP connection details
    const host = String(b.sftp_host ?? '').trim();
    const port = Number(b.sftp_port) || 22;
    const username = String(b.sftp_username ?? '').trim();

    if (host || b.sftp_enabled) {
      const hostError = validateSftpHost(host);
      if (hostError) return NextResponse.json({ error: hostError }, { status: 422 });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'SFTP port must be between 1 and 65535.' }, { status: 422 });
    }

    try {
      row.sftp_pdf_path = cleanRemoteDir(b.sftp_pdf_path);
      row.sftp_csv_path = cleanRemoteDir(b.sftp_csv_path);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }

    row.sftp_host = host || null;
    row.sftp_port = port;
    row.sftp_username = username || null;

    // Secrets: blank = keep what is stored. Only a typed value replaces it.
    const newPassword = typeof b.sftp_password === 'string' && b.sftp_password !== '' ? b.sftp_password : null;
    const newKey = typeof b.sftp_private_key === 'string' && b.sftp_private_key.trim() !== '' ? b.sftp_private_key : null;
    row.sftp_password_enc    = newPassword ? encryptSecret(newPassword) : existing?.sftp_password_enc ?? null;
    row.sftp_private_key_enc = newKey ? encryptSecret(newKey) : existing?.sftp_private_key_enc ?? null;
    if (b.clear_password)    row.sftp_password_enc = null;
    if (b.clear_private_key) row.sftp_private_key_enc = null;

    // The pinned host key only holds for the same server; changing it (or asking) re-trusts on next connect
    const serverChanged = existing && (existing.sftp_host !== row.sftp_host || existing.sftp_port !== row.sftp_port);
    row.sftp_host_fingerprint = (serverChanged || b.reset_host_key) ? null : existing?.sftp_host_fingerprint ?? null;

    if (row.sftp_enabled) {
      if (!username) return NextResponse.json({ error: 'SFTP username is required.' }, { status: 422 });
      if (!row.sftp_password_enc && !row.sftp_private_key_enc) {
        return NextResponse.json({ error: 'Enter an SFTP password or private key.' }, { status: 422 });
      }
      if (!row.sftp_send_pdf && !row.sftp_send_csv) {
        return NextResponse.json({ error: 'Choose at least one file type to send by SFTP.' }, { status: 422 });
      }
    }

    const { error } = await supabase
      .from('supplier_transmission_settings').upsert(row, { onConflict: 'supplier_id' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/transmission-settings/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
