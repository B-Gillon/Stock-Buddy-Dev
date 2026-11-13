// /src/app/api/suppliers/[id]/sftp-test/route.js
// Tests the supplier's SAVED SFTP settings: logs in and checks that the drop folders exist.
// Nothing is written to the supplier's server.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';
import { getTransmissionSettings, isSftpReady } from '@/lib/transmissionSettings';
import { testSftpConnection, validateSftpHost } from '@/lib/sftp';

export async function POST(request, { params }) {
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;

    const { data: supplier } = await supabase
      .from('suppliers').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const settings = await getTransmissionSettings(id, { withSecrets: true });
    if (!isSftpReady({ ...settings, sftp_enabled: true })) {
      return NextResponse.json({ ok: false, error: 'Save the host, username and a password or key first.' }, { status: 422 });
    }
    const hostError = validateSftpHost(settings.sftp_host);
    if (hostError) return NextResponse.json({ ok: false, error: hostError }, { status: 422 });

    try {
      const result = await testSftpConnection(settings);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
  } catch (err) {
    await logError({ source: 'api/suppliers/[id]/sftp-test/POST', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
