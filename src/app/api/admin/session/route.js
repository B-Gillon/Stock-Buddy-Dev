// /src/app/api/admin/session/route.js
// Called on page load to record that a tenant accessed the app.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { logError } from '@/lib/logError';

export async function POST(request) {
  try {
    const tenantId = await getTenantId(request);
    const body = await request.json().catch(() => ({}));
    const path = body.path || null;

    await supabase.from('beta_tester_sessions').insert({
      tenant_id:   tenantId,
      accessed_at: new Date().toISOString(),
      path,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // Session tracking failures are non-fatal — log silently
    await logError({ source: 'api/admin/session', error: err });
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
