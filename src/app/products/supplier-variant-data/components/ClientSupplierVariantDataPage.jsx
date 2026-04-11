"use client";

// /src/app/products/supplier-variant-data/components/ClientSupplierVariantDataPage.jsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";

function Card({ title, bullets, buttonLabel, onButton }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <button
          onClick={onButton}
          className="shrink-0 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition"
        >
          {buttonLabel}
        </button>
      </div>
      <ul className="space-y-1.5">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ClientSupplierVariantDataPage({ lastSyncedAt }) {
  const router = useRouter();
  const [syncing,    setSyncing]    = useState(false);
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);
  const [banner,     setBanner]     = useState(null);

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res  = await fetch("/api/sync/products", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setLastSynced(data.last_synced_at ?? new Date().toISOString());
      setBanner({ type: "success", message: "Products sync complete." });
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppLayout
      title="Supplier Product Data"
      showActionBar={false}
      actions={{
        onSync:       handleSync,
        syncing:      syncing,
        lastSyncedAt: lastSynced,
        syncLabel:    "Sync Products",
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

      <div className="grid grid-cols-2 gap-6">
        <Card
          title="Manually Add/Edit Supplier Product Data"
          bullets={[
            "Update supplier‑specific details directly in the app",
            "No CSV required",
            "Best for quick changes or fixing individual items",
          ]}
          buttonLabel="Open Editor"
          onButton={() => router.push("/products/supplier-variant-data/edit")}
        />
        <Card
          title="Add/Edit Supplier Product Data via CSV"
          bullets={[
            "Follow a guided workflow to upload a CSV",
            "Update supplier‑specific product information in bulk",
            "Upload only the rows you want to change",
          ]}
          buttonLabel="Upload CSV"
          onButton={() => router.push("/products/supplier-variant-data/import")}
        />
      </div>
    </AppLayout>
  );
}
