/**
 * src/lib/shopify/stateCookie.js
 *
 * Signed cookie utility for OAuth CSRF protection.
 *
 * During the OAuth install flow, a nonce is generated and sent to Shopify
 * as the `state` param. Shopify returns it unchanged in the callback.
 * To prevent CSRF attacks, we store the nonce in a signed cookie during
 * install and verify it matches the returned state in the callback.
 *
 * Signing uses HMAC-SHA256 with SHOPIFY_API_SECRET so the cookie value
 * cannot be forged by an attacker without knowing the secret.
 *
 * Cookie format:  {nonce}.{base64url-signature}
 *
 * Exports:
 *   setStateCookie(response, nonce)  — signs and sets the cookie on a response
 *   verifyStateCookie(request, state) — reads, verifies, and validates the cookie
 */

const SECRET = process.env.SHOPIFY_API_SECRET;
const COOKIE_NAME = "shopify_oauth_state";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes — enough time to complete OAuth

function encode(str) {
  return new TextEncoder().encode(str);
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getKey() {
  if (!SECRET) {
    throw new Error("SHOPIFY_API_SECRET is not set.");
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
 * Sign a nonce and return a cookie value string.
 * Format: {nonce}.{signature}
 */
async function signNonce(nonce) {
  const key = await getKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encode(nonce));
  const signature = toBase64Url(signatureBuffer);
  return `${nonce}.${signature}`;
}

/**
 * Verify a signed cookie value against a given nonce.
 * Returns true only if the signature is valid and the nonce matches.
 */
async function verifySignedValue(cookieValue, expectedNonce) {
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const nonce = cookieValue.substring(0, dotIndex);
  const signature = cookieValue.substring(dotIndex + 1);

  // Nonce in cookie must match the state param returned by Shopify
  if (nonce !== expectedNonce) return false;

  // Recompute signature and compare
  const key = await getKey();
  const expectedSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encode(nonce)
  );
  const expectedSignature = toBase64Url(expectedSignatureBuffer);

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Set a signed state cookie on a NextResponse.
 *
 * @param {NextResponse} response — the response to attach the cookie to
 * @param {string} nonce — the OAuth state nonce to store
 */
export async function setStateCookie(response, nonce) {
  const signedValue = await signNonce(nonce);

  response.cookies.set(COOKIE_NAME, signedValue, {
    httpOnly: true,           // not accessible to JS
    secure: true,             // HTTPS only
    sameSite: "none",         // required for cross-domain OAuth redirect
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Read and verify the state cookie from an incoming request.
 * Returns true if the cookie is present, valid, and matches the state param.
 * Returns false if the cookie is missing, tampered with, or doesn't match.
 *
 * @param {Request} request — the incoming callback request
 * @param {string} state — the state param returned by Shopify
 * @returns {Promise<boolean>}
 */
export async function verifyStateCookie(request, state) {
  if (!state) return false;

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;

  // Parse the specific cookie we need
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...val] = c.trim().split("=");
      return [key.trim(), val.join("=").trim()];
    })
  );

  const cookieValue = cookies[COOKIE_NAME];
  if (!cookieValue) return false;

  return await verifySignedValue(cookieValue, state);
}

/**
 * Clear the state cookie on a response after use.
 * Always call this in the callback route after verifying the state,
 * whether verification succeeded or failed.
 *
 * @param {NextResponse} response — the response to clear the cookie on
 */
export function clearStateCookie(response) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
    path: "/",
  });
}
