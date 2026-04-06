// /src/shared/utils/getStoreSettings.js
// Server-side utility — fetches app-wide settings from the settings table.
// Call this in any server component that needs store-level config.
// Returns safe defaults if the table is empty or a key is missing.

import { supabase, setTenantContext } from "@/lib/supabaseClient";

/**
 * Fetch all settings rows and return them as a plain key→value object.
 * @param {string} tenantId - Required. Resolved via getTenantId() in the calling server component.
 * @returns {Promise<{ store_name: string, [key: string]: string }>}
 */
export async function getStoreSettings(tenantId) {
  if (!tenantId) {
    console.error("getStoreSettings: tenantId is required");
    return { store_name: "My Store" };
  }

  await setTenantContext(supabase, tenantId);

  const { data, error } = await supabase
    .from("settings")
    .select("key, value");

if (error) {
  console.error("getStoreSettings error:", error);
  return { store_name: "My Store" };
}
if (!data || data.length === 0) {
  return { store_name: "My Store" };
}

  const settings = {};
  for (const row of data) {
    settings[row.key] = row.value;
  }

  return {
    store_name: "My Store",
    ...settings,
  };
}
