// Remove HTML tags from a string
export function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "");
}

// Extract the final category from a Shopify-style path
export function formatCategory(path) {
  if (!path) return "—";
  const parts = path.split(">");
  return parts[parts.length - 1].trim();
}

// Normalize product/variant status to Title Case
export function formatStatus(status) {
  if (!status) return "—";
  const s = status.toString().trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Format a number as USD currency
export function formatCurrency(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}