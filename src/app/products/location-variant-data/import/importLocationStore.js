// /src/app/products/location-variant-data/import/importLocationStore.js
// Uses sessionStorage to persist parsed CSV data across page navigations.

const STORAGE_KEY = "location_variant_import_data";

export function setImportData(parsedData, unknownHandling, locationId, locationName) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      parsedData,
      unknownHandling,
      locationId,
      locationName,
    }));
  } catch (e) {
    console.error("Failed to save import data to sessionStorage:", e);
  }
}

export function getImportData() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { parsedData: null, unknownHandling: "error", locationId: null, locationName: null };
    return JSON.parse(raw);
  } catch (e) {
    return { parsedData: null, unknownHandling: "error", locationId: null, locationName: null };
  }
}

export function clearImportData() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}
