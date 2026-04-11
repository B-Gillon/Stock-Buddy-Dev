"use client";

// /src/app/locations/components/ClientLocationsPage.jsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";

const COLUMNS = [
  { key: "name",          label: "Location"        },
  { key: "primary_name",  label: "Primary Contact" },
  { key: "primary_role",  label: "Role"            },
  { key: "primary_email", label: "Primary Email"   },
  { key: "primary_phone", label: "Primary Phone"   },
];

function formatPhone(raw) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

function sortRows(rows, key, direction) {
  if (!key || !direction) return rows;
  return [...rows].sort((a, b) => {
    const aVal = a[key] ?? "";
    const bVal = b[key] ?? "";
    return direction === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
}

export default function ClientLocationsPage({ locations, lastSyncedAt }) {
  const router        = useRouter();
  const locations_raw = locations ?? [];

  const [syncing,    setSyncing]    = useState(false);
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [banner,     setBanner]     = useState(null);
  const [sortKey,    setSortKey]    = useState("name");
  const [sortDir,    setSortDir]    = useState("asc");

  function handleSort(key) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else setSortDir("asc");
  }

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync/locations", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Sync failed. Please try again.");
      setLastSynced(new Date().toISOString());
      setBanner({ type: "success", message: "Locations sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message ?? "Sync failed. Please try again." });
    } finally {
      setSyncing(false);
    }
  }

  const sortedRows = sortRows(locations_raw, sortKey, sortDir);

  return (
    <AppLayout
      title="Locations"
      showActionBar={false}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSynced,
        syncLabel:    "Sync Locations",
      }}
    >
      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-md text-sm font-medium ${
          banner.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {banner.message}
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 border-b border-gray-300">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="text-left px-2 py-2 font-medium cursor-pointer select-none hover:bg-gray-300 transition-colors whitespace-nowrap"
              >
                {col.label}
                <SortIcon direction={sortKey === col.key ? sortDir : null} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-gray-400">
                No locations found.
              </td>
            </tr>
          ) : (
            sortedRows.map((location) => (
              <tr
                key={location.id}
                onClick={() => router.push(`/locations/${location.slug}`)}
                className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-2 py-2 font-medium text-gray-900">{location.name || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{location.primary_name  || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{location.primary_role  || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{location.primary_email || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{formatPhone(location.primary_phone)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </AppLayout>
  );
}
