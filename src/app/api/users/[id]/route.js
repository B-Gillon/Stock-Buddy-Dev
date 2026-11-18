// /src/app/api/users/[id]/route.js — resend the invite, disable or re-enable a user
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getTenantId } from '@/lib/tenants';
import { createAuthToken } from '@/lib/auth/tokens';
import { sendPasswordLinkEmail, appUrl } from '@/lib/auth/inviteEmail';
import { logError } from '@/lib/logError';

export async function PATCH(request, { params }) {
  if (request.headers.get('x-auth-role') === 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let tenantId = null;
  try {
    tenantId = await getTenantId(request);
    const { id } = await params;
    const { action, username: newName } = await request.json();

    const { data: user } = await supabase.from('app_users')
      .select('id, email, status, password_hash, supplier:suppliers ( supplier_name )')
      .eq('id', id).eq('tenant_id', tenantId).maybeSingle();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (action === 'username') {
      const name = String(newName ?? '').trim().replace(/\s+/g, ' ');
      if (!/^[A-Za-z0-9][A-Za-z0-9 ._'-]{1,39}$/.test(name)) return NextResponse.json({ error: 'Enter a username (2–40 characters: letters, numbers, spaces, . _ - \').' }, { status: 400 });
      const { error } = await supabase.from('app_users').update({ username: name }).eq('id', id).eq('tenant_id', tenantId);
      if (error) return NextResponse.json({ error: error.code === '23505' ? 'That username is already in use.' : 'Could not save.' }, { status: error.code === '23505' ? 409 : 500 });
      return NextResponse.json({ success: true });
    }
    if (action === 'disable') {
      await supabase.from('app_users').update({ status: 'disabled' }).eq('id', id);
      return NextResponse.json({ success: true });
    }
    if (action === 'enable') {
      await supabase.from('app_users').update({ status: user.password_hash ? 'active' : 'invited', failed_attempts: 0, locked_until: null }).eq('id', id);
      return NextResponse.json({ success: true });
    }
    if (action === 'resend') {
      if (user.status === 'disabled') return NextResponse.json({ error: 'Enable this user first.' }, { status: 400 });
      const { data: tenant } = await supabase.from('tenants').select('shop_name').eq('id', tenantId).maybeSingle();
      const supplier = Array.isArray(user.supplier) ? user.supplier[0] : user.supplier;
      const kind = user.password_hash ? 'reset' : 'invite';
      const raw = await createAuthToken(id, kind === 'reset' ? 'reset_password' : 'set_password');
      await sendPasswordLinkEmail({ to: user.email, link: appUrl(`/set-password/${raw}`), kind,
        retailerName: tenant?.shop_name, supplierName: supplier?.supplier_name });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    await logError({ source: 'api/users/[id]/PATCH', error: err, tenantId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
