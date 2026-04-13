// /src/lib/sync/syncLocations.js

import fetchLocations from "./fetchLocations.js";
import processLocations from "./processLocations.js";
import { insertRows, updateSyncStatus, supabase } from "./supabaseHelpers.js";

export default async function syncLocations(tenantId, credentials = {}) {

  // 1. FETCH LOCATIONS FROM SHOPIFY
  const shopifyLocations = await fetchLocations(credentials);

  // 2. PROCESS + UPSERT ACTIVE LOCATIONS
  const locations = processLocations(shopifyLocations, tenantId);
  await insertRows("locations", locations, tenantId);

  // 3. MARK MISSING LOCATIONS AS INACTIVE
  // Shopify omits deactivated locations from the API response entirely.
  // Any location in our DB that wasn't returned by Shopify should be marked inactive.
  const activeShopifyIds = shopifyLocations.map((l) =>
    parseInt(l.id.replace("gid://shopify/Location/", ""), 10)
  );

  if (activeShopifyIds.length > 0) {
    const { error } = await supabase
      .from("locations")
      .update({ active: false })
      .eq("tenant_id", tenantId)
      .not("shopify_location_id", "in", `(${activeShopifyIds.join(",")})`)
      .eq("active", true); // Only update rows that are currently active

    if (error) {
      console.error("Error marking locations inactive:", error.message);
      throw new Error(`Failed to mark inactive locations: ${error.message}`);
    }
  }

  // 4. UPDATE SYNC STATUS
  await updateSyncStatus("locations", tenantId);

}
