/**
 * src/lib/shopify/hmac.js
 *
 * HMAC verification utilities for Shopify OAuth and webhooks.
 * Uses the Web Crypto API (available in Node.js 18+ and Edge Runtime).
 *
 * Exports:
 *   verifyOAuthHmac(searchParams)  — for install and callback query strings
 *   verifyWebhookHmac(rawBody, signature) — for incoming webhook requests
 */

const SECRET = process.env.SHOPIFY_API_SECRET;

// Params that Shopify does NOT include in the HMAC signature.
// The embedded app OAuth flow adds several extra params (host, locale,
// id_token, session, embedded) that are not part of the signed message.
// Shopify only signs: shop, timestamp, code, state (on callback).
const EXCLUDED_PARAMS = new Set([
  "hmac",
  "id_token",
  "session",
  "embedded",
  "host",
  "locale",
]);

/**
 * Encode a string as UTF-8 bytes.
 */
function encode(str) {
  return new TextEncoder().encode(str);
}

/**
 * Import the app secret as a CryptoKey for HMAC-SHA256 signing.
 */
async function getKey() {
  if (!SECRET) {
    throw new Error("SHOPIFY_API_SECRET is not set in environment variables.");
  }
  return crypto.subtle.importKey(
    "raw",
    encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify the HMAC on an OAuth request (install or callback).
 *
 * Shopify signs only a core subset of query parameters — shop, timestamp,
 * and OAuth-specific params (code, state). Embedded app params like host,
 * locale, id_token, session, and embedded are excluded from the signature.
 *
 * @param {URLSearchParams} searchParams — from the incoming request URL
 * @returns {Promise<boolean>}
 */
export async function verifyOAuthHmac(searchParams) {
  const receivedHmac = searchParams.get("hmac");
  if (!receivedHmac) return false;

  // Build the message: exclude params Shopify doesn't sign, sort the rest
  const params = [];
  for (const [key, value] of searchParams.entries()) {
    if (EXCLUDED_PARAMS.has(key)) continue;
    const encodedKey = key.replace(/%/g, "%25").replace(/&/g, "%26");
    const encodedValue = value.replace(/%/g, "%25").replace(/&/g, "%26");
    params.push(`${encodedKey}=${encodedValue}`);
  }
  params.sort();
  const message = params.join("&");

  console.log("[HMAC] Message to sign:", message);

  const key = await getKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encode(message));
  const computedHmac = bufferToHex(signatureBuffer);

  console.log("[HMAC] Computed:", computedHmac);
  console.log("[HMAC] Received:", receivedHmac);

  return safeEqual(computedHmac, receivedHmac);
}

/**
 * Verify the HMAC on an incoming Shopify webhook.
 *
 * Shopify sends the base64-encoded HMAC-SHA256 of the raw request body
 * in the X-Shopify-Hmac-SHA256 header.
 *
 * @param {string | Buffer | Uint8Array} rawBody — the raw, unparsed request body
 * @param {string} signature — the value of X-Shopify-Hmac-SHA256
 * @returns {Promise<boolean>}
 */
export async function verifyWebhookHmac(rawBody, signature) {
  if (!signature) return false;

  const bodyBytes =
    typeof rawBody === "string" ? encode(rawBody) : new Uint8Array(rawBody);

  const key = await getKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyBytes);
  const computedBase64 = Buffer.from(signatureBuffer).toString("base64");

  return safeEqual(computedBase64, signature);
}
