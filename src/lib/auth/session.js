// /src/lib/auth/session.js
// Signed session cookie for website logins. The cookie holds who the user is (user, store, role,
// supplier) and an expiry, signed with HMAC so it can't be forged or edited.
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'sb-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getKey() {
  const secret = process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error('No session signing key (set SESSION_SECRET).');
  return Buffer.from(hkdfSync('sha256', secret, 'stock-buddy', 'session-cookies', 32));
}
const sign = (text) => createHmac('sha256', getKey()).update(text).digest('base64url');

/** @param {{uid:string, tid:string, shop:string, role:'retailer'|'supplier', sid:string|null}} p */
export function createSessionValue(p, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Returns the session payload, or null if missing, forged or expired. */
export function readSessionValue(value, now = Date.now()) {
  try {
    const [body, sig, extra] = String(value ?? '').split('.');
    if (!body || !sig || extra !== undefined) return null;
    const a = Buffer.from(sig); const b = Buffer.from(sign(body));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p?.uid || !p?.shop || !['retailer', 'supplier'].includes(p.role)) return null;
    if (!p.exp || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
