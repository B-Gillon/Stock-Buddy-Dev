"use client";

// /src/app/dashboard/components/ClientDashboard.jsx

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppLayout from "@/shared/components/layout/AppLayout";

// ── Shared card shell ──────────────────────────────────────────────────────

function DashCard({ title, onClick, headerRight, children }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-2 ${
        onClick ? "cursor-pointer hover:border-gray-300 hover:shadow-md transition" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

// ── Card 1 — Low Stock ─────────────────────────────────────────────────────

function LowStockCard({ lowStock, onClick }) {
  const outOfStock = lowStock.filter((v) => v.available <= 0).length;
  const pill = outOfStock > 0 ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      {outOfStock} Out of Stock
    </span>
  ) : null;

  return (
    <DashCard title="Low Stock" onClick={onClick} headerRight={pill}>
      {lowStock.length === 0 ? (
        <p className="text-sm text-gray-400">No low stock items.</p>
      ) : (
        <table className="w-full text-sm border-collapse dashboard-table" style={{lineHeight:"1"}}>
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="text-left py-1 font-medium">Variant</th>
              <th className="text-left py-1 font-medium">SKU</th>
              <th className="text-left py-1 font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((v) => (
              <tr key={v.variant_id} className="border-b border-gray-50 last:border-0" style={{height:"22px"}}>
                <td className="py-1 pr-3 text-gray-800 truncate max-w-[180px]">{v.title}</td>
                <td className="py-1 pr-3 text-gray-500 text-xs">{v.sku}</td>
                <td className="py-1">
                  <span className={`font-medium text-xs ${
                    v.available <= 0 ? "text-red-600" :
                    v.available <= 5 ? "text-amber-600" :
                    "text-gray-800"
                  }`}>
                    {v.available}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashCard>
  );
}

// ── Card 2 — Overdue POs ───────────────────────────────────────────────────

function OverduePOsCard({ overduePOs, onClick }) {
  const count = overduePOs.length;
  const pill = (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      count > 0
        ? "bg-red-100 text-red-700 border-red-200"
        : "bg-gray-100 text-gray-500 border-gray-200"
    }`}>
      {count} Overdue
    </span>
  );

  return (
    <DashCard title="Overdue Purchase Orders" onClick={onClick} headerRight={pill}>
      {count === 0 ? (
        <p className="text-sm text-gray-400">No overdue purchase orders.</p>
      ) : (
        <>
          <table className="w-full text-sm border-collapse dashboard-table">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left py-1 font-medium">PO #</th>
                <th className="text-left py-1 font-medium">Supplier</th>
                <th className="text-left py-1 font-medium">Expected Date</th>
              </tr>
            </thead>
            <tbody>
              {overduePOs.slice(0, 3).map((po) => (
                <tr key={po.id} className="border-b border-gray-50 last:border-0" style={{height:"22px"}}>
                  <td className="py-1 pr-3 text-xs font-medium text-gray-800 whitespace-nowrap">{po.po_number}</td>
                  <td className="py-1 pr-3 text-xs text-gray-600 truncate max-w-[120px]">{po.supplier_name}</td>
                  <td className="py-1 text-xs text-red-500 font-medium whitespace-nowrap">
                    {new Date(po.expected_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {count > 3 && (
            <p className="text-xs text-gray-400">+{count - 3} more</p>
          )}
        </>
      )}
    </DashCard>
  );
}

// ── Card 3 — Getting Started ───────────────────────────────────────────────

const QUICK_LINKS = [
  { label: "Create a purchase order", href: "/purchase-orders/create" },
  { label: "Receive items on a PO",   href: "/purchase-orders"        },
  { label: "Add a supplier",          href: "/suppliers"              },
  { label: "View inventory levels",   href: "/inventory"              },
];

function GettingStartedCard({ onNavigate }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  async function handleSync(e) {
    e.stopPropagation();
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/sync/all", { method: "POST" });
      if (!res.ok) throw new Error("Sync returned error status.");
      setSyncMsg("Sync complete.");
    } catch (err) {
      setSyncMsg("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DashCard title="Getting Started">
      <ul className="space-y-0">
        {QUICK_LINKS.map((link) => (
          <li key={link.href} style={{height:"22px"}} className="flex items-center">
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(link.href); }}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left transition"
            >
              → {link.label}
            </button>
          </li>
        ))}
        <li style={{height:"22px"}} className="flex items-center">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left transition disabled:opacity-50"
          >
            → {syncing ? "Syncing…" : "Sync inventory from Shopify"}
          </button>
          {syncMsg && <span className="ml-2 text-xs text-gray-400">{syncMsg}</span>}
        </li>
      </ul>
    </DashCard>
  );
}

// ── Card 4 — Incoming Inventory ────────────────────────────────────────────

function IncomingInventoryCard({ totalIncoming, topIncoming, onClick }) {
  const pill = (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
      {totalIncoming.toLocaleString()} Units
    </span>
  );

  return (
    <DashCard title="Incoming Inventory" onClick={onClick} headerRight={pill}>
      {topIncoming.length === 0 ? (
        <p className="text-sm text-gray-400">No incoming inventory.</p>
      ) : (
        <table className="w-full text-sm border-collapse dashboard-table" style={{lineHeight:"1"}}>
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="text-left py-1 font-medium">Variant</th>
              <th className="text-left py-1 font-medium">PO #</th>
              <th className="text-left py-1 font-medium">Expected Date</th>
              <th className="text-left py-1 font-medium">Incoming</th>
            </tr>
          </thead>
          <tbody>
            {topIncoming.map((item) => (
              <tr key={item.variant_id} className="border-b border-gray-50 last:border-0" style={{height:"22px"}}>
                <td className="py-1 pr-3 text-gray-800 truncate max-w-[160px] text-xs font-medium">{item.title}</td>
                <td className="py-1 pr-3 text-xs text-gray-600 whitespace-nowrap">{item.po_number}</td>
                <td className="py-1 pr-3 text-xs text-gray-600 whitespace-nowrap">
                  {item.expected_date
                    ? new Date(item.expected_date).toLocaleDateString()
                    : "—"}
                </td>
                <td className="py-1 text-xs font-semibold text-gray-800 whitespace-nowrap">
                  {item.incoming.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashCard>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function ClientDashboard({
  lowStock,
  overduePOs,
  totalIncoming,
  topIncoming,
  lastSyncedAt,
}) {
  const router = useRouter();
  const [syncing,    setSyncing]    = useState(false);
  const [lastSynced, setLastSynced] = useState(lastSyncedAt);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/all", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed.");
      setLastSynced(new Date().toISOString());
    } catch (err) {
      console.error("Dashboard sync error:", err.message);
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
        syncLabel:    "Sync Everything",
        lastSyncedAt: lastSynced,
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <style>{'.dashboard-table tbody tr { height: 22px !important; } .dashboard-table tbody td { padding-top: 2px !important; padding-bottom: 2px !important; }'}</style>
        <LowStockCard
          lowStock={lowStock}
          onClick={() => router.push("/inventory")}
        />
        <OverduePOsCard
          overduePOs={overduePOs}
          onClick={() => router.push("/purchase-orders?status=overdue")}
        />
        <GettingStartedCard
          onNavigate={(href) => router.push(href)}
        />
        <IncomingInventoryCard
          totalIncoming={totalIncoming}
          topIncoming={topIncoming}
          onClick={() => router.push("/purchase-orders")}
        />
      </div>
    </AppLayout>
  );
}
