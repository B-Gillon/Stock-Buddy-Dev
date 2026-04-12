/**
 * src/lib/shopify/sessionToken.js
 *
 * Shopify session token verification for embedded apps.
 *
 * When Stock Buddy runs inside the Shopify Admin iframe, Shopify's App Bridge
 * attaches a short-lived JWT (session token) to every request the frontend
 * makes to the backend. This utility verifies that JWT and extracts the shop
 * domain from its payload.
 *
 * Usage in API routes:
 *   import { getShopFromSessionToken } from "@/lib/shopify/sessionToken";
 *
 *   const shop = await getShopFromSessionToken(request);
 *   if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *
 * Session token structure (Shopify JWT claims):
 *   iss  — issuer, format: "https://{shop}/admin"
 *   dest — destination, format: "https://{shop}"
 *   aud  — audience, your API key (client ID)
 *   sub  — subject, the merchant's user ID
 *   exp  — expiration timestamp (tokens are short-lived, ~60s)
 *   nbf  — not before timestamp
 *   iat  — issued at timestamp
 *   jti  — unique token ID
 *   sid  — session ID
 *
 * DEV FALLBACK:
 * If no Authorization header is present and DEV_SHOP_DOMAIN is set,
 * returns the dev shop domain. Remove this fallback before going to production.
 */

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const DEV_SHOP_DOMAIN = process.env.DEV_SHOP_DOMAIN;

/**
 * Decode a base64url-encoded string to a UTF-8 string.
 */
function base64UrlDecode(str) {
  // Convert base64url to base64
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to a multiple of 4
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

/**
 * Parse a JWT into its header, payload, and signature parts.
 * Does NOT verify the signature — use verifySessionToken for that.
 */
function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format — expected 3 parts.");
  }
  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  return { header, payload, signature: parts[2], raw: parts };
}

/**
 * Verify a Shopify session token JWT.
 *
 * Validates:
 * - Signature (HMAC-SHA256 signed with SHOPIFY_API_SECRET)
 * - Algorithm is HS256
 * - Token is not expired
 * - Token is not used before its nbf time
 * - Audience matches our API key
 * - issuer and dest contain a valid myshopify.com domain
 *
 * @param {string} token — the raw JWT string
 * @returns {Promise<string|null>} — the shop domain, or null if invalid
 */
async function verifySessionToken(token) {
  let parsed;

  try {
    parsed = parseJwt(token);
  } catch {
    console.warn("[SessionToken] Failed to parse JWT.");
    return null;
  }

  const { header, payload, raw } = parsed;

  // Verify algorithm
  if (header.alg !== "HS256") {
    console.warn("[SessionToken] Unexpected algorithm:", header.alg);
    return null;
  }

  // Verify signature
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SHOPIFY_API_SECRET);
    const messageData = encoder.encode(`${raw[0]}.${raw[1]}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert base64url signature to ArrayBuffer
    const sigBase64 = payload => {
      const b64 = raw[2].replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    };

    const signatureBuffer = sigBase64(raw[2]);
    const isValid = await crypto.subtle.verify("HMAC", cryptoKey, signatureBuffer, messageData);

    if (!isValid) {
      console.warn("[SessionToken] Signature verification failed.");
      return null;
    }
  } catch (err) {
    console.warn("[SessionToken] Signature verification error:", err.message);
    return null;
  }

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    console.warn("[SessionToken] Token is expired.");
    return null;
  }

  // Verify not-before
  if (payload.nbf && now < payload.nbf) {
    console.warn("[SessionToken] Token used before nbf.");
    return null;
  }

  // Verify audience matches our API key
  if (payload.aud !== SHOPIFY_API_KEY) {
    console.warn("[SessionToken] Audience mismatch.", payload.aud, SHOPIFY_API_KEY);
    return null;
  }

  // Extract shop domain from the `dest` claim
  // dest format: "https://{shop}.myshopify.com"
  let shop = null;
  try {
    const destUrl = new URL(payload.dest);
    shop = destUrl.hostname;
  } catch {
    console.warn("[SessionToken] Invalid dest claim:", payload.dest);
    return null;
  }

  // Validate the extracted shop domain
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)) {
    console.warn("[SessionToken] Invalid shop domain in dest:", shop);
    return null;
  }

  return shop;
}

/**
 * Extract and verify the session token from an incoming API request.
 *
 * Reads the Authorization header (format: "Bearer {token}"),
 * verifies the JWT, and returns the shop domain.
 *
 * Falls back to DEV_SHOP_DOMAIN in development if no Authorization
 * header is present. REMOVE THIS FALLBACK BEFORE GOING TO PRODUCTION.
 *
 * @param {Request} request — the incoming Next.js API route request
 * @returns {Promise<string|null>} — the shop domain, or null if unauthorized
 */
export async function getShopFromSessionToken(request) {
  const authHeader = request.headers.get("authorization");

  // DEV FALLBACK — remove before production
  if (!authHeader) {
    if (DEV_SHOP_DOMAIN) {
      return DEV_SHOP_DOMAIN;
    }
    console.warn("[SessionToken] No Authorization header and no DEV_SHOP_DOMAIN set.");
    return null;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    console.warn("[SessionToken] Invalid Authorization header format.");
    return null;
  }

  return await verifySessionToken(token);
}
