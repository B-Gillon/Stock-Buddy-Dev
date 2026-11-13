"use client";

// /src/app/purchase-orders/[slug]/components/POHistoryTable.jsx
// Activity history for a single PO. Timestamps are shown in the viewer's local time zone.

const ACTION_LABELS = {
  created:      "Created",
  edited:       "Edited",
  released:     "Released",
  resent:       "Resent",
  acknowledged: "Acknowledged",
  cancelled:    "Cancelled",
  received:     "Received",
  closed:       "Closed",
  error:        "Error",
};

const ACTION_STYLES = {
  created:      "bg-gray-100 text-gray-700",
  edited:       "bg-amber-50 text-amber-700",
  released:     "bg-blue-50 text-blue-700",
  resent:       "bg-blue-50 text-blue-700",
  acknowledged: "bg-green-50 text-green-700",
  cancelled:    "bg-red-50 text-red-700",
  received:     "bg-green-50 text-green-700",
  closed:       "bg-gray-100 text-gray-700",
  error:        "bg-red-50 text-red-700",
};

// MM/DD/YY HH:MM AM/PM TZ  (e.g. 11/13/26 02:05 PM EST)
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      month: "2-digit", day: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZoneName: "short",
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

export default function POHistoryTable({ rows }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">
          History<span className="ml-2 text-xs font-normal text-gray-400">({rows.length})</span>
        </h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Date/Time</th>
            <th className="text-left px-3 py-2 font-medium">Activity</th>
            <th className="text-left px-3 py-2 font-medium">User</th>
            <th className="text-left px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                No activity has been recorded for this purchase order.
              </td>
            </tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap" suppressHydrationWarning>
                {fmtDateTime(row.created_at)}
              </td>
              <td className="px-3 py-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[row.action] ?? "bg-gray-100 text-gray-700"}`}>
                  {ACTION_LABELS[row.action] ?? row.action}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700">{row.user_name || <span className="text-gray-400">Unknown</span>}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-pre-wrap">{row.comments || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
