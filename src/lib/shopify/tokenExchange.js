/**
 * src/lib/shopify/tokenExchange.js
 *
 * Exchanges a Shopify App Bridge session token (JWT) for a permanent
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

/**
 * Exchange a session token for an offline access token.
 *
 * @param {string} shop         — the shop domain, e.g. "brandongtest.myshopify.com"
 * @param {string} sessionToken — the raw JWT from the Authorization header
 * @returns {Promise<string>}   — the offline access token (shpua_...)
 */
export async function exchangeTokenForAccess(shop, sessionToken) {
  const url = `https://${shop}/admin/oauth/access_token`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:            SHOPIFY_API_KEY,
      client_secret:        SHOPIFY_API_SECRET,
      grant_type:           "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token:        sessionToken,
      subject_token_type:   "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${text}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("No access_token in token exchange response.");
  }

  return data.access_token;
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
