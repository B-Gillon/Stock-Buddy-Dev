// /src/app/products/location-variant-data/import/validateLocationImportRows.js
// Validates parsed rows against the database.
// Returns enriched rows with status: "valid" | "unknown" | "skipped" | "error"

import { REQUIRED_FIELD } from "./parseLocationImportCSV";

/**
 * Validate rows against a Set of known variant IDs from the DB.
 * @param {Array}  rows             - parsed rows from parseLocationImportCSV
 * @param {Set}    knownVariantIds  - Set of shopify_variant_id strings from DB
 * @param {string} unknownHandling  - "error" | "ignore"
 */
export function validateLocationImportRows(rows, knownVariantIds, unknownHandling) {
  return rows.map((row) => {
    if (!row.variant_id) {
      return {
        ...row,
        status: "error",
        errorMessage: "Missing required variant_id.",
      };
    }

    const isKnown = knownVariantIds.has(String(row.variant_id));

    if (!isKnown) {
      if (unknownHandling === "ignore") {
        return { ...row, status: "skipped", errorMessage: null };
      } else {
        return {
          ...row,
          status: "unknown",
          errorMessage: `Variant ID "${row.variant_id}" not found in database.`,
        };
      }
    }

    return { ...row, status: "valid", errorMessage: null };
  });
}

/**
 * Returns true if import can proceed (no blocking errors/unknowns).
 */
export function canSubmit(validatedRows, unknownHandling) {
  if (unknownHandling === "error") {
    return !validatedRows.some(
      (r) => r.status === "unknown" || r.status === "error"
    );
  }
  return !validatedRows.some((r) => r.status === "error");
}
