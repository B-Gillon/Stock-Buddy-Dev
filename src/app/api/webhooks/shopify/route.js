/**
 * src/app/api/webhooks/shopify/route.js
 *
 * Receives Shopify webhooks. Every request is verified with the app secret (X-Shopify-Hmac-SHA256)
 * before anything is read from it; a bad signature gets a 401.
 *
 *   app/uninstalled       -> the stored token is dead: mark the tenant uninstalled and drop its refresh token,
 *                            so a reinstall gets a brand-new token instead of reusing the revoked one.
 *   customers/data_request,
 *   customers/redact,
 *   shop/redact           -> mandatory privacy webhooks: recorded in shopify_compliance_requests and answered 200.
 */
import { NextResponse } from "next/server";
import { verifyWebhookHmac } from "@/lib/shopify/hmac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COMPLIANCE_TOPICS = new Set(["customers/data_request", "customers/redact", "shop/redact"]);

export async function POST(request) {
  const rawBody = await request.text();
  const valid = await verifyWebhookHmac(rawBody, request.headers.get("x-shopify-hmac-sha256")).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shop = (request.headers.get("x-shopify-shop-domain") ?? "").toLowerCase();
  if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  try {
    if (topic === "app/uninstalled") {
      const triggeredAt = request.headers.get("x-shopify-triggered-at");
      const { data: tenant } = await supabaseAdmin.from("tenants").select("installed_at").eq("shop_domain", shop).maybeSingle();
      // A late uninstall notice must not wipe the token of an app that was reinstalled after it
      const reinstalledSince = tenant?.installed_at && triggeredAt && new Date(tenant.installed_at) > new Date(triggeredAt);
      if (tenant && !reinstalledSince) {
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin.from("tenants").update({
          uninstalled_at: now,
          refresh_token: null,
          access_token_expires_at: now,          // in the past: the stored access token counts as expired
          refresh_token_expires_at: now,
          updated_at: now,
        }).eq("shop_domain", shop);
        if (error) throw new Error(error.message);
      }
    } else if (COMPLIANCE_TOPICS.has(topic)) {
      let payload = null;
      try { payload = JSON.parse(rawBody); } catch { /* keep null */ }
      const { error } = await supabaseAdmin.from("shopify_compliance_requests").insert({ shop_domain: shop, topic, payload });
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    console.error("[Webhook] Failed to handle", topic, "for", shop, "-", err.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 }); // Shopify retries
  }
  return NextResponse.json({ ok: true });
}
