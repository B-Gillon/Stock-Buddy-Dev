// /src/app/api/auth/set-password/route.js — used by both the invite and the reset links
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { consumeAuthToken, peekAuthToken } from '@/lib/auth/tokens';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { signedInResponse } from '@/lib/auth/session-cookie';

export async function POST(request) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const { token, password } = body;

  const problem = validatePassword(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Check the user first so a disabled account doesn't burn the link
  const peek = await peekAuthToken(token);
  if (!peek) return NextResponse.json({ error: 'This link has expired or was already used. Ask for a new one.' }, { status: 410 });

  const row = await consumeAuthToken(token);
  if (!row) return NextResponse.json({ error: 'This link has expired or was already used. Ask for a new one.' }, { status: 410 });

  const { data: user } = await supabase
    .from('app_users')
    .select('id, tenant_id, role, supplier_id, status, tenant:tenants ( shop_domain )')
    .eq('id', row.user_id).maybeSingle();
  if (!user || user.status === 'disabled') {
    return NextResponse.json({ error: 'This account is not active. Contact the person who invited you.' }, { status: 403 });
  }

  await supabase.from('app_users').update({
    password_hash: await hashPassword(password),
    status: 'active', failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(),
  }).eq('id', user.id);

  const tenant = Array.isArray(user.tenant) ? user.tenant[0] : user.tenant;
  return signedInResponse(user, tenant.shop_domain);
}
