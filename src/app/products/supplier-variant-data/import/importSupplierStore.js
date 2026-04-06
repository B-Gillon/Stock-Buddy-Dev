// /src/app/products/import-supplier-info/importSupplierStore.js
// Uses sessionStorage to persist parsed CSV data across page navigations.

const STORAGE_KEY = "supplier_import_data";

export function setImportData(parsedData, unknownHandling, supplierId, supplierName) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      parsedData,
      unknownHandling,
      supplierId,
      supplierName,
    }));
  } catch (e) {
    console.error("Failed to save import data to sessionStorage:", e);
  }
}

export function getImportData() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { parsedData: null, unknownHandling: "error", supplierId: null, supplierName: null };
    return JSON.parse(raw);
  } catch (e) {
    return { parsedData: null, unknownHandling: "error", supplierId: null, supplierName: null };
  }
}

export function clearImportData() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}
