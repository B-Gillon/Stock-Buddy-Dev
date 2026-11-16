// /src/lib/auth/session-cookie.js
// Helpers for API routes that start or end a website session.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/auth/session';

export const homeFor = (role) => (role === 'supplier' ? '/supplier-portal' : '/dashboard');

/** JSON response that also signs the user in. */
export function signedInResponse(user, shopDomain) {
  const res = NextResponse.json({ success: true, redirect: homeFor(user.role) });
  res.cookies.set(SESSION_COOKIE, createSessionValue({
    uid: user.id, tid: user.tenant_id, shop: shopDomain, role: user.role, sid: user.supplier_id ?? null,
  }), sessionCookieOptions);
  return res;
}
