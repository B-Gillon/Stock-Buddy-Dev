"use client";

// /src/app/dashboard/components/ClientDashboard.jsx

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

// ── Purchase Order Report ──────────────────────────────────────────────────

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

const REPORT_ROWS = [
  { key: "overdue",  label: "Overdue",                     color: "#dc2626", tone: "text-red-600",   href: "/purchase-orders?status=overdue" },
  { key: "thisWeek", label: "Due to ship this week",       color: "#f59e0b", tone: "text-amber-600" },
  { key: "later",    label: "Due to ship after this week", color: "#16a34a", tone: "text-green-700" },
  { key: "drafts",   label: "Drafts",                      color: "#2563eb", tone: "text-blue-700",  href: "/purchase-orders?status=draft" },
];
const VIEW_KEY = "dashboard_po_report_view";

function ReportDonut({ poReport }) {
  const total = REPORT_ROWS.reduce((t, r) => t + poReport[r.key].count, 0);
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label="Purchase orders by status">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#f3f4f6" strokeWidth="16" />
      {total > 0 && REPORT_ROWS.map((r) => {
        const n = poReport[r.key].count;
        if (!n) return null;
        const len = (n / total) * C;
        const el = (
          <circle key={r.key} cx="60" cy="60" r={R} fill="none" stroke={r.color} strokeWidth="16"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
        );
        offset += len;
        return el;
      })}
      <text x="60" y="58" textAnchor="middle" className="fill-gray-800" style={{ fontSize: 22, fontWeight: 700 }}>{total}</text>
      <text x="60" y="74" textAnchor="middle" className="fill-gray-400" style={{ fontSize: 12 }}>POs</text>
    </svg>
  );
}

function POReportCard({ poReport, onNavigate }) {
  const [view, setView] = useState("donut");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "donut" || v === "bar") setView(v); } catch {}
  }, []);
  const choose = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };

  const toggle = (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-300 text-xs" onClick={(e) => e.stopPropagation()}>
      {[["donut", "Donut"], ["bar", "Bar"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => choose(v)} aria-pressed={view === v}
          className={`px-2.5 py-1 ${view === v ? "bg-gray-100 font-semibold text-gray-900" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  const label = (r) => r.href
    ? <button onClick={() => onNavigate(r.href)} className="p-0 text-left hover:underline">{r.label}</button>
    : r.label;

  return (
    <DashCard title="Purchase Order Report" headerRight={toggle}>
      {view === "donut" ? (
        <div className="flex items-center gap-5">
          <ReportDonut poReport={poReport} />
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
            {REPORT_ROWS.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="flex-1 truncate text-gray-700">{label(r)}</span>
                <span className={`font-semibold ${poReport[r.key].count > 0 ? r.tone : "text-gray-300"}`}>{poReport[r.key].count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {REPORT_ROWS.map((r) => {
            const n = poReport[r.key].count;
            const max = Math.max(1, ...REPORT_ROWS.map((x) => poReport[x.key].count));
            return (
              <li key={r.key} className="text-xs" title={`${n} PO${n === 1 ? "" : "s"} · ${money(poReport[r.key].cost)}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-gray-700">{label(r)}</span>
                  <span className={`font-semibold ${n > 0 ? r.tone : "text-gray-300"}`}>{n}</span>
                </div>
                <div className="h-3 w-full rounded bg-gray-100">
                  <div className="h-3 rounded" style={{ width: `${(n / max) * 100}%`, background: r.color }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
  poReport,
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
        <OverduePOsCard
          overduePOs={overduePOs}
          onClick={() => router.push("/purchase-orders?status=overdue")}
        />
        <POReportCard poReport={poReport} onNavigate={(href) => router.push(href)} />
        <LowStockCard
          lowStock={lowStock}
          onClick={() => router.push("/inventory")}
        />
        {/* "Getting Started" card is hidden (not removed): <GettingStartedCard onNavigate={(href) => router.push(href)} /> */}
        <IncomingInventoryCard
          totalIncoming={totalIncoming}
          topIncoming={topIncoming}
          onClick={() => router.push("/purchase-orders")}
        />
      </div>
    </AppLayout>
  );
}
