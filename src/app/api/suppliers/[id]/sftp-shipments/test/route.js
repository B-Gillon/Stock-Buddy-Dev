// Tests the supplier's SAVED SFTP Shipments settings: logs in and checks the shipment folder exists.
// Nothing is written to the supplier's server.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { getShipmentSftpSettings } from '@/lib/shipmentSftpSettings';
import { testSftpShipments, validateSftpHost } from '@/lib/sftp';

export async function POST(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const s = await getShipmentSftpSettings(id, { withSecrets: true });
    if (!(s.sftp_host && s.sftp_username && (s.has_password || s.has_private_key))) {
      return NextResponse.json({ ok: false, error: 'Save the host, username and a password or key first.' }, { status: 422 });
    }
    const hostError = validateSftpHost(s.sftp_host);
    if (hostError) return NextResponse.json({ ok: false, error: hostError }, { status: 422 });
    try {
      return NextResponse.json(await testSftpShipments(s));
    } catch (err) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-shipments/test/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
