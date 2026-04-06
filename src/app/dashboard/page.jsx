"use client";

// /src/app/dashboard/page.jsx

import { useState, useEffect } from "react";
import Link from "next/link";
import AppLayout from "@/shared/components/layout/AppLayout";

export default function DashboardPage() {
  const [syncing,      setSyncing]      = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [banner,       setBanner]       = useState(null);

  // Load last "all" sync timestamp on mount
  useEffect(() => {
    fetch("/api/sync-status?type=all")
      .then((r) => r.json())
      .then((d) => { if (d.last_synced_at) setLastSyncedAt(d.last_synced_at); })
      .catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        throw new Error(data.error ?? "Sync failed. Please try again.");
      }
      setLastSyncedAt(data.last_synced_at ?? new Date().toISOString());
      if (res.status === 207) {
        setBanner({ type: "error", message: `Sync completed with errors: ${data.errors?.join(", ")}` });
      } else {
        setBanner({ type: "success", message: "All syncs completed successfully." });
      }
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppLayout
      title="Dashboard"
      showActionBar={false}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSyncedAt,
        syncLabel:    "Sync Everything",
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

      {/* Mascot + Hero Row */}
      <div className="flex items-center gap-6 mb-6">
        <img
          src="/mascot.png"
          alt="Stock Buddy Mascot"
          className="w-32 h-auto object-contain"
        />
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center">
          <p className="text-gray-500">
            Placeholder for future messaging, stats, or welcome text.
          </p>
        </div>
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/products">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 cursor-pointer hover:shadow-md transition">
            <h3 className="text-lg font-semibold mb-1">Products</h3>
            <p className="text-sm text-gray-500">View and manage all products.</p>
          </div>
        </Link>
        <Link href="/variants">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 cursor-pointer hover:shadow-md transition">
            <h3 className="text-lg font-semibold mb-1">Variants</h3>
            <p className="text-sm text-gray-500">View and manage all variants.</p>
          </div>
        </Link>
        <Link href="/vendors">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 cursor-pointer hover:shadow-md transition">
            <h3 className="text-lg font-semibold mb-1">Vendors</h3>
            <p className="text-sm text-gray-500">Manage your supplier list.</p>
          </div>
        </Link>
        <Link href="/inventory">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 cursor-pointer hover:shadow-md transition">
            <h3 className="text-lg font-semibold mb-1">Inventory</h3>
            <p className="text-sm text-gray-500">Track inventory levels across all locations.</p>
          </div>
        </Link>
        <Link href="/locations">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 cursor-pointer hover:shadow-md transition">
            <h3 className="text-lg font-semibold mb-1">Locations</h3>
            <p className="text-sm text-gray-500">View and manage fulfillment locations.</p>
          </div>
        </Link>
      </div>
    </AppLayout>
  );
}
