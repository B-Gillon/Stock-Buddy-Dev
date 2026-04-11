/**
 * Minimal RFC 4180-compliant CSV parser.
 * Returns an array of objects keyed by the header row.
 * Handles quoted fields, escaped double-quotes, and CRLF/LF line endings.
 */
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = splitCsvLine(nonEmpty[0]).map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = splitCsvLine(nonEmpty[i]);
    if (values.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}
