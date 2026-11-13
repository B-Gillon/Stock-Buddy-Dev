/**
 * src/lib/shopify/userCookie.js
 *
 * Signed `sb-user` cookie that records which Shopify staff user is using the
 * app (name + id). It is set by /api/shopify/token-exchange after Shopify has
 * verified the session token, and read by API routes that write the PO
 * activity history.
 *
 * Format: {base64url(JSON)}.{base64url(HMAC-SHA256 with SHOPIFY_API_SECRET)}
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const USER_COOKIE = "sb-user";
const MAX_AGE = 60 * 60 * 8; // 8 hours, same as sb-shop

function sign(payload) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("SHOPIFY_API_SECRET is not set.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function setUserCookie(response, user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name })).toString("base64url");
  response.cookies.set(USER_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure:   true,
    sameSite: "none", // required for the Shopify iframe context
    path:     "/",
    maxAge:   MAX_AGE,
  });
}

/**
 * Returns { id, name } from a valid sb-user cookie, or null.
 */
export function readUserCookie(request) {
  try {
    const raw = request.cookies?.get?.(USER_COOKIE)?.value
      ?? (request.headers.get("cookie") ?? "")
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${USER_COOKIE}=`))
        ?.slice(USER_COOKIE.length + 1);
    if (!raw) return null;

    const dot = raw.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = raw.slice(0, dot);
    const given   = Buffer.from(raw.slice(dot + 1));
    const wanted  = Buffer.from(sign(payload));
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.name) return null;
    return { id: String(data.id ?? ""), name: String(data.name) };
  } catch {
    return null;
  }
}
