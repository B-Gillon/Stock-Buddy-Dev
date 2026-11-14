// /src/lib/ackLink.js
// Signed links for PO acknowledgement. The emailed link carries the acknowledgement id plus an
// HMAC signature, so it can't be guessed or altered. Nothing secret is stored in the database.
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

function getKey() {
  const secret = process.env.ACK_LINK_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error('No signing key available (set ACK_LINK_SECRET).');
  return Buffer.from(hkdfSync('sha256', secret, 'stock-buddy', 'acknowledgement-links', 32));
}

const sign = (text) => createHmac('sha256', getKey()).update(text).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Token placed in the emailed link: "<ack id>.<signature>". */
export function signAckToken(ackId) {
  return `${ackId}.${sign(`ack:${ackId}`)}`;
}

/** Returns the acknowledgement id if the token is genuine, otherwise null. */
export function verifyAckToken(token) {
  try {
    const [id, sig, extra] = String(token ?? '').split('.');
    if (!id || !sig || extra !== undefined || !UUID.test(id)) return null;
    return safeEqual(sig, sign(`ack:${id}`)) ? id : null;
  } catch {
    return null;
  }
}

/** Full link for the supplier's email. */
export function buildAckUrl(ackId) {
  const base = String(process.env.SHOPIFY_APP_URL || '').replace(/\/+$/, '');
  return `${base}/acknowledge/${signAckToken(ackId)}`;
}

/** Stamped when the page is shown; the submit must come a few seconds later (blocks instant bots). */
export function signRenderStamp(ackId, now = Date.now()) {
  return `${now}.${sign(`render:${ackId}:${now}`)}`;
}

/** True if the stamp is genuine, at least minAgeMs old, and not older than maxAgeMs. */
export function checkRenderStamp(ackId, stamp, { minAgeMs = 2000, maxAgeMs = 7 * 24 * 3600 * 1000, now = Date.now() } = {}) {
  try {
    const [ts, sig, extra] = String(stamp ?? '').split('.');
    const t = Number(ts);
    if (!ts || !sig || extra !== undefined || !Number.isFinite(t)) return false;
    if (!safeEqual(sig, sign(`render:${ackId}:${t}`))) return false;
    const age = now - t;
    return age >= minAgeMs && age <= maxAgeMs;
  } catch {
    return false;
  }
}
