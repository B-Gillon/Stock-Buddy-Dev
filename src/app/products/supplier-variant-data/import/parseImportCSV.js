// /src/app/products/supplier-variant-data/import/parseImportCSV.js

export const REQUIRED_FIELD = "Variant ID";
export const DELETE_MARKER  = "/";

// CSV header → supplier_variants column mapping
// SKU (Supplier) and Barcode (Supplier) are intentionally excluded —
// those values live on the variants table and are display-only in the CSV.
export const FIELD_MAP = {
  "Item Code (Supplier)":  "item_code",
  "Supplier Cost":         "cost",
  "Initial Average Cost":  "initial_average_cost",
  "Min Order Qty":         "moq",
  "Order in Multiples Of": "order_increment",
  "Case Pack Qty":         "case_pack",
  "Inner Pack":            "inner_pack",
  "Lead Days":             "lead_days",
  "Notes":                 "notes",
};

export const SUPPORTED_FIELDS = [REQUIRED_FIELD, ...Object.keys(FIELD_MAP)];

export const NUMERIC_FIELDS = new Set([
  "Supplier Cost",
  "Initial Average Cost",
  "Min Order Qty",
  "Order in Multiples Of",
  "Case Pack Qty",
  "Inner Pack",
  "Lead Days",
]);

/**
 * Parse a raw CSV string.
 * Returns { headers, rows, unknownHeaders }
 *   rows — array of { rowIndex, variant_id, fields: { csvFieldName: value | DELETE_MARKER | undefined } }
 */
export function parseImportCSV(csvText) {
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
