// /src/app/products/location-variant-data/import/parseLocationImportCSV.js

export const REQUIRED_FIELD = "Variant ID";
export const DELETE_MARKER  = "/";

// CSV header → variant_location_bins column mapping
export const FIELD_MAP = {
  "Bin Location": "bin_location",
};

// All headers the importer recognises — unknown headers outside this list
// will be flagged as warnings. Display-only fields (SKU, Barcode, Display Title)
// are listed here so they don't trigger unknown-header warnings when present
// in a downloaded/re-uploaded CSV, but they are NOT in FIELD_MAP so they
// are never written to the database.
export const SUPPORTED_FIELDS = [
  REQUIRED_FIELD,
  "SKU",
  "Barcode",
  "Display Title",
  ...Object.keys(FIELD_MAP),
];

export const NUMERIC_FIELDS = new Set([
  // none currently — bin_location is text
]);

/**
 * Parse a raw CSV string.
 * Returns { headers, rows, unknownHeaders }
 *   rows — array of { rowIndex, variant_id, fields: { csvFieldName: value | DELETE_MARKER | undefined } }
 */
export function parseLocationImportCSV(csvText) {
  // Strip BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, "");

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  const headers        = parseCSVLine(lines[0]);
  const unknownHeaders = headers.filter((h) => h && !SUPPORTED_FIELDS.includes(h));

  const variantIdIndex = headers.indexOf(REQUIRED_FIELD);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const fields = {};

    headers.forEach((header, colIndex) => {
      if (!header || !FIELD_MAP[header]) return;
      const raw = values[colIndex];
      if (raw === undefined || raw === "") {
        fields[header] = undefined; // blank = no-op
      } else if (raw === DELETE_MARKER) {
        fields[header] = DELETE_MARKER;
      } else {
        fields[header] = raw;
      }
    });

    const rawVariantId =
      variantIdIndex >= 0 ? values[variantIdIndex] : undefined;

    rows.push({
      rowIndex:   i,
      variant_id: rawVariantId?.trim() || "",
      fields,
    });
  }

  return { headers, rows, unknownHeaders };
}

function parseCSVLine(line) {
  const result = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
