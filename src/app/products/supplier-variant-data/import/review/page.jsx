// /src/app/products/supplier-variant-data/import/review/page.jsx

import { supabase } from "@/lib/supabaseClient";
import ClientReviewPage from "./components/ClientReviewPage";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { data: variants } = await supabase
    .from("variants")
    .select("shopify_variant_id");

  const knownVariantIds = (variants ?? []).map((v) => String(v.shopify_variant_id));

  return <ClientReviewPage knownVariantIds={knownVariantIds} />;
}
