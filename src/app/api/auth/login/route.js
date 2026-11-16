// /src/app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { verifyPassword, fakeVerify } from '@/lib/auth/password';
import { signedInResponse } from '@/lib/auth/session-cookie';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const BAD = () => NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });

export async function POST(request) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password || password.length > 200) return BAD();

  const { data: user } = await supabase
    .from('app_users')
    .select('id, tenant_id, email, role, supplier_id, password_hash, status, failed_attempts, locked_until, tenant:tenants ( shop_domain )')
    .eq('email', email)
    .maybeSingle();

  if (!user || !user.password_hash || user.status !== 'active') { await fakeVerify(); return BAD(); }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes, or reset your password.' }, { status: 429 });
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    const fails = (user.failed_attempts ?? 0) + 1;
    await supabase.from('app_users').update(fails >= MAX_FAILS
      ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
      : { failed_attempts: fails }).eq('id', user.id);
    return BAD();
  }

  const tenant = Array.isArray(user.tenant) ? user.tenant[0] : user.tenant;
  if (!tenant?.shop_domain) return BAD();

  await supabase.from('app_users')
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  return signedInResponse(user, tenant.shop_domain);
}
