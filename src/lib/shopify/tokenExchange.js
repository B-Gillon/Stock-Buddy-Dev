/**
 * src/lib/shopify/tokenExchange.js
 *
 * Exchanges a Shopify App Bridge session token (JWT) for an expiring
 * offline access token using Shopify's OAuth token exchange flow.
 *
 * This is the correct auth pattern for embedded apps that use
 * "Use legacy install flow: false" in the Shopify Dev Dashboard.
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/auth/get-access-tokens/token-exchange
 */

const SHOPIFY_API_KEY    = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

const TOKEN_URL = (shop) => `https://${shop}/admin/oauth/access_token`;

async function postForm(shop, fields) {
  return fetch(TOKEN_URL(shop), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
  });
}

// Shopify returns expires_in / refresh_token_expires_in in seconds.
function parseExpiringToken(data) {
  if (!data.access_token) throw new Error("No access_token in Shopify token response.");
  if (!data.refresh_token || !data.expires_in) {
    throw new Error("Shopify did not return an expiring token (no refresh_token / expires_in).");
  }
  const now = Date.now();
  return {
    accessToken:           data.access_token,
    expiresAt:             new Date(now + data.expires_in * 1000).toISOString(),
    refreshToken:          data.refresh_token,
    refreshTokenExpiresAt: data.refresh_token_expires_in
      ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
      : null,
  };
}

/**
 * Exchange a session token for an EXPIRING offline access token (1 hour) plus a refresh token.
 *
 * @param {string} shop         — e.g. "brandongtest.myshopify.com"
 * @param {string} sessionToken — the raw JWT from the Authorization header
 * @returns {Promise<{accessToken, expiresAt, refreshToken, refreshTokenExpiresAt}>}
 */
export async function exchangeTokenForAccess(shop, sessionToken) {
  const response = await postForm(shop, {
    client_id:            SHOPIFY_API_KEY,
    client_secret:        SHOPIFY_API_SECRET,
    grant_type:           "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token:        sessionToken,
    subject_token_type:   "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring:             "1",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${text}`);
  }
  return parseExpiringToken(await response.json());
}

/**
 * Use a refresh token to get a new access token + a NEW refresh token.
 * The old refresh token stops being the one to use: store the new pair.
 */
export async function refreshOfflineToken(shop, refreshToken) {
  const response = await postForm(shop, {
    client_id:     SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`Token refresh failed: ${response.status} — ${text.slice(0, 200)}`);
    err.status = response.status;
    throw err;
  }
  return parseExpiringToken(await response.json());
}

/**
 * Exchange a session token for an online access token and return the
 * Shopify staff user who is currently using the app.
 * Only the user's identity is used; the online token itself is discarded.
 *
 * @returns {Promise<{ id: string, name: string, email: string|null }|null>}
 */
export async function exchangeTokenForOnlineUser(shop, sessionToken) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:            SHOPIFY_API_KEY,
      client_secret:        SHOPIFY_API_SECRET,
      grant_type:           "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token:        sessionToken,
      subject_token_type:   "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.warn(`[TokenExchange] Online token exchange failed: ${response.status} ${text.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const u = data.associated_user;
  if (!u) {
    console.warn("[TokenExchange] Online token exchange returned no associated_user.");
    return null;
  }

  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email || null;
  if (!name) return null;

  return { id: String(u.id ?? ""), name, email: u.email ?? null };
}
