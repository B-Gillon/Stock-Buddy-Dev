/**
 * Badge
 * Generic status badge.
 *
 * Props:
 *   status — string key looked up in the statusMap
 *   statusMap — optional override: { [key]: { label, className } }
 *
 * Default status map covers PO statuses.
 */

const DEFAULT_MAP = {
  draft:              { label: "Draft",              className: "bg-gray-100 text-gray-600" },
  released:           { label: "Released",           className: "bg-blue-100 text-blue-700" },
  held:               { label: "Held",               className: "bg-amber-100 text-amber-700" },
  partially_received: { label: "Partially Received", className: "bg-amber-100 text-amber-700" },
  received:           { label: "Received",           className: "bg-green-100 text-green-700" },
  cancelled:          { label: "Cancelled",          className: "bg-red-100 text-red-700" },
  active:             { label: "Active",             className: "bg-green-100 text-green-700" },
  inactive:           { label: "Inactive",           className: "bg-gray-100 text-gray-500" },
};

export default function Badge({ status, statusMap }) {
  const map = statusMap ?? DEFAULT_MAP;
  const entry = map[status];
  const label = entry?.label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : "—");
  const className = entry?.className ?? "bg-gray-100 text-gray-500";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
