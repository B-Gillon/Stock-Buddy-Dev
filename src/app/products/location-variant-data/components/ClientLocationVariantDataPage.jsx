"use client";

// /src/app/products/location-variant-data/components/ClientLocationVariantDataPage.jsx

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

export default function ClientLocationVariantDataPage() {
  const router = useRouter();

  return (
    <AppLayout
      title="Location Variant Data"
      showActionBar={false}
    >
      <div className="grid grid-cols-2 gap-6">
        <Card
          title="Manually Add/Edit Location Variant Data"
          bullets={[
            "Update location‑specific details directly in the app",
            "No CSV required",
            "Best for quick changes or fixing individual items",
          ]}
          buttonLabel="Open Editor"
          onButton={() => router.push("/products/location-variant-data/edit")}
        />
        <Card
          title="Add/Edit Location Variant Data via CSV"
          bullets={[
            "Follow a guided workflow to upload a CSV",
            "Update location‑specific variant information in bulk",
            "Upload only the rows you want to change",
          ]}
          buttonLabel="Upload CSV"
          onButton={() => router.push("/products/location-variant-data/import")}
        />
      </div>
    </AppLayout>
  );
}
