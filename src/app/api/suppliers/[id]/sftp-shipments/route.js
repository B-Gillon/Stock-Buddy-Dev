// /src/app/api/suppliers/[id]/sftp-shipments/route.js
// SFTP Shipments settings for a supplier. Passwords / private keys are write-only:
// encrypted on save and never sent back to the browser.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { getShipmentSftpSettings } from '@/lib/shipmentSftpSettings';
import { encryptSecret } from '@/lib/secretBox';
import { validateSftpHost, cleanRemoteDir } from '@/lib/sftp';

async function assertSupplier(supplierId, tenantId) {
  const { data } = await supabase.from('suppliers').select('id').eq('id', supplierId).eq('tenant_id', tenantId).maybeSingle();
  return !!data;
}

export async function GET(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const s = await getShipmentSftpSettings(id);
    return NextResponse.json({
      settings: {
        sftp_enabled: !!s.sftp_enabled, sftp_host: s.sftp_host ?? '', sftp_port: s.sftp_port ?? 22,
        sftp_username: s.sftp_username ?? '', sftp_folder: s.sftp_folder ?? '', sftp_pickup_prefix: s.sftp_pickup_prefix ?? '',
        has_password: s.has_password, has_private_key: s.has_private_key, host_fingerprint: s.sftp_host_fingerprint ?? null,
      },
    });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/GET', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    if (!(await assertSupplier(id, tenantId))) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    const b = await request.json();

    const { data: existing } = await supabase.from('supplier_shipment_sftp_settings').select('*').eq('supplier_id', id).maybeSingle();

    const host = String(b.sftp_host ?? '').trim();
    const port = Number(b.sftp_port) || 22;
    const username = String(b.sftp_username ?? '').trim();
    if (host || b.sftp_enabled) {
      const hostError = validateSftpHost(host);
      if (hostError) return NextResponse.json({ error: hostError }, { status: 422 });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) return NextResponse.json({ error: 'SFTP port must be between 1 and 65535.' }, { status: 422 });

    let folder;
    try { folder = cleanRemoteDir(b.sftp_folder); } catch (e) { return NextResponse.json({ error: e.message }, { status: 422 }); }

    const prefix = String(b.sftp_pickup_prefix ?? '').trim();
    if (prefix.length > 100 || /[\/\\\0]/.test(prefix) || prefix.includes('..')) {
      return NextResponse.json({ error: 'The pickup prefix must be a file-name start (no slashes), up to 100 characters.' }, { status: 422 });
    }

    const row = {
      tenant_id: tenantId, supplier_id: id, sftp_enabled: !!b.sftp_enabled,
      sftp_host: host || null, sftp_port: port, sftp_username: username || null, sftp_folder: folder, sftp_pickup_prefix: prefix || null,
      updated_at: new Date().toISOString(),
    };

    // Secrets: blank = keep what is stored. Only a typed value replaces it.
    const pw = typeof b.sftp_password === 'string' ? b.sftp_password.trim() : '';
    const key = typeof b.sftp_private_key === 'string' && b.sftp_private_key.trim() !== '' ? b.sftp_private_key : null;
    row.sftp_password_enc    = pw ? encryptSecret(pw) : existing?.sftp_password_enc ?? null;
    row.sftp_private_key_enc = key ? encryptSecret(key) : existing?.sftp_private_key_enc ?? null;

    // The pinned host key only holds for the same server
    const serverChanged = existing && (existing.sftp_host !== row.sftp_host || existing.sftp_port !== row.sftp_port);
    row.sftp_host_fingerprint = (serverChanged || b.reset_host_key) ? null : existing?.sftp_host_fingerprint ?? null;

    if (row.sftp_enabled) {
      if (!username) return NextResponse.json({ error: 'SFTP username is required.' }, { status: 422 });
      if (!row.sftp_password_enc && !row.sftp_private_key_enc) return NextResponse.json({ error: 'Enter an SFTP password or private key.' }, { status: 422 });
      if (!folder) return NextResponse.json({ error: 'Enter the SFTP pickup folder.' }, { status: 422 });
    }

    const { error } = await supabase.from('supplier_shipment_sftp_settings').upsert(row, { onConflict: 'supplier_id' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
