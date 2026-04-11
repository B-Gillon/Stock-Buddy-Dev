"use client";

// /src/app/suppliers/components/ClientSuppliersPage.jsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/shared/components/layout/AppLayout";
import SortIcon from "@/shared/components/icons/SortIcon";
import Button from "@/shared/components/ui/Button";

const COLUMNS = [
  { key: "supplier_name",  label: "Supplier Name",  sortable: true },
  { key: "contact_name",   label: "Contact Name",   sortable: true },
  { key: "contact_email",  label: "Contact Email",  sortable: true },
  { key: "phone",          label: "Contact Phone",  sortable: true },
];

function formatPhone(raw) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw;
}

function sortRows(rows, key, direction) {
  if (!key || !direction) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    return direction === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}

export default function ClientSuppliersPage({ suppliers }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState("supplier_name");
  const [sortDir, setSortDir] = useState("asc");

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortRows(suppliers, sortKey, sortDir);

  return (
    <AppLayout title="Suppliers" showActionBar={false}>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => router.push("/suppliers/new")}>Add Supplier</Button>
      </div>

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
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-2 py-8 text-center text-gray-400">
                No suppliers found. Add your first supplier to get started.
              </td>
            </tr>
          ) : (
            sorted.map((supplier) => (
              <tr
                key={supplier.id}
                onClick={() => router.push(`/suppliers/${supplier.supplier_number}`)}
                className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-2 py-2 font-medium text-gray-900">{supplier.supplier_name}</td>
                <td className="px-2 py-2 text-gray-600">{supplier.contact_name || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{supplier.contact_email || "—"}</td>
                <td className="px-2 py-2 text-gray-600">{formatPhone(supplier.phone)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </AppLayout>
  );
}
