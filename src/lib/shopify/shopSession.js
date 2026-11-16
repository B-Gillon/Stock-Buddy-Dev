// /src/lib/shopify/shopSession.js
// Proof of "which Shopify store is this?" for requests that come from the embedded app.
//
// The store is only ever accepted from something Shopify signed, never from a plain URL value:
//   • a session token (JWT) – Authorization header or ?id_token=
//   • Shopify's signed app-load URL (?hmac=… over the other query params)
//   • our own signed cookie, which we only issue after one of the above checked out
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

export const SHOP_COOKIE = 'sb-shop-v2';
const SHOP_COOKIE_TTL = 60 * 60 * 8; // 8 hours
const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
export const isShopDomain = (s) => typeof s === 'string' && SHOP_RE.test(s);

function cookieKey() {
  const secret = process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error('No signing key (set SESSION_SECRET).');
  return Buffer.from(hkdfSync('sha256', secret, 'stock-buddy', 'shop-cookie', 32));
}
const sign = (text) => createHmac('sha256', cookieKey()).update(text).digest('base64url');
const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function createShopCookieValue(shop, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ shop, exp: Math.floor(now / 1000) + SHOP_COOKIE_TTL })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** The store named by our signed cookie, or null. */
export function readShopCookieValue(value, now = Date.now()) {
  try {
    const [body, sig, extra] = String(value ?? '').split('.');
    if (!body || !sig || extra !== undefined || !eq(sig, sign(body))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return isShopDomain(p.shop) && p.exp * 1000 > now ? p.shop : null;
  } catch {
    return null;
  }
}

export const shopCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none', // needed inside the Shopify iframe
  path: '/',
  maxAge: SHOP_COOKIE_TTL,
};

/**
 * Checks Shopify's signature on an app-load URL. Returns the shop, or null.
 * @param {URLSearchParams} params
 */
export function verifyShopifyLoadUrl(params, now = Date.now(), maxAgeSeconds = 3600) {
  try {
    const secret = process.env.SHOPIFY_API_SECRET;
    const given = params.get('hmac');
    const shop = params.get('shop');
    const ts = Number(params.get('timestamp'));
    if (!secret || !given || !isShopDomain(shop) || !Number.isFinite(ts)) return null;
    const age = Math.floor(now / 1000) - ts;
    if (age > maxAgeSeconds || age < -300) return null;

    const message = [...params.entries()]
      .filter(([k]) => k !== 'hmac' && k !== 'signature')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const expected = createHmac('sha256', secret).update(message).digest('hex');
    return eq(given, expected) ? shop : null;
  } catch {
    return null;
  }
}
