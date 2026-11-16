// /src/app/api/auth/forgot/route.js — always answers the same, so it can't be used to find out who has an account
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { createAuthToken } from '@/lib/auth/tokens';
import { sendPasswordLinkEmail, appUrl } from '@/lib/auth/inviteEmail';

export async function POST(request) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const email = String(body.email ?? '').trim().toLowerCase();
  const done = NextResponse.json({ success: true });
  if (!email || email.length > 200) return done;

  try {
    const { data: user } = await supabase
      .from('app_users').select('id, email, status, supplier_id, tenant:tenants ( shop_name )')
      .eq('email', email).maybeSingle();
    if (!user || user.status !== 'active') return done;

    // At most one reset email a minute per account
    const { data: recent } = await supabase.from('auth_tokens').select('created_at')
      .eq('user_id', user.id).eq('purpose', 'reset_password')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()).limit(1);
    if (recent?.length) return done;

    const raw = await createAuthToken(user.id, 'reset_password');
    const tenant = Array.isArray(user.tenant) ? user.tenant[0] : user.tenant;
    await sendPasswordLinkEmail({ to: user.email, link: appUrl(`/set-password/${raw}`), kind: 'reset', retailerName: tenant?.shop_name });
  } catch (err) {
    console.error('[auth/forgot] failed:', err);
  }
  return done;
}
