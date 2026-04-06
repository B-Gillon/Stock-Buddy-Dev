// /src/app/product/[id]/page.jsx
// SERVER COMPONENT — no "use client"

import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import ClientProductDetailPage from "@/app/product/components/ClientProductDetailPage";

export default async function ProductDetailPage({ params }) {
  const { id } = await params;

  const [productRes, variantsRes, syncRes] = await Promise.all([
    supabase.from("products").select("*").eq("shopify_product_id", id).single(),
    supabase
      .from("variants")
      .select("*")
      .eq("shopify_product_id", id)
      .order("display_title", { ascending: true }),
    supabase
      .from("sync_status")
      .select("last_synced_at")
      .eq("sync_type", "products")
      .single(),
  ]);

  if (!productRes.data) notFound();

  return (
    <ClientProductDetailPage
      product={productRes.data}
      variants={variantsRes.data || []}
      lastSyncedAt={syncRes.data?.last_synced_at ?? null}
    />
  );
}
