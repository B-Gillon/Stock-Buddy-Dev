// /src/lib/sync/syncLocations.js

import fetchLocations from "./fetchLocations.js";
import processLocations from "./processLocations.js";
import { insertRows, updateSyncStatus } from "./supabaseHelpers.js";

export default async function syncLocations(tenantId, credentials = {}) {

  // 1. FETCH LOCATIONS FROM SHOPIFY
  const shopifyLocations = await fetchLocations(credentials);

  // 2. PROCESS + INSERT LOCATIONS
  const locations = processLocations(shopifyLocations, tenantId);

  await insertRows("locations", locations, tenantId);

  // 3. UPDATE SYNC STATUS
  await updateSyncStatus("locations", tenantId);

}
