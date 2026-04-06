import fetchLocations from "./fetchLocations.js";
import processLocations from "./processLocations.js";
import { insertRows, updateSyncStatus } from "./supabaseHelpers.js";

export default async function syncLocations() {
  console.log("syncLocations() is RUNNING");

  // 1. FETCH LOCATIONS FROM SHOPIFY
  const shopifyLocations = await fetchLocations();

  // 2. PROCESS + INSERT LOCATIONS
  const locations = processLocations(shopifyLocations);

  await insertRows("locations", locations);
  console.log(`Inserted ${locations.length} locations.`);

  // 3. UPDATE SYNC STATUS
  await updateSyncStatus("locations");

  console.log("syncLocations: Done.");
}