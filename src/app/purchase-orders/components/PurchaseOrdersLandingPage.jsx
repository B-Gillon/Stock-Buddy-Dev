'use client';

import { useRouter } from 'next/navigation';
import AppLayout from '@/shared/components/layout/AppLayout';
import Button from '@/shared/components/ui/Button';
import POTabsRow from './POTabsRow';
import POFiltersRow from './POFiltersRow';
import POTable from './POTable';

function exportCSV(purchaseOrders) {
  if (!purchaseOrders.length) { alert('No purchase orders to export.'); return; }
  const headers = ['PO Number', 'Supplier', 'Location', 'Status', 'PO Date', 'Expected Date', 'Total Cost'];
  const rows = purchaseOrders.map((po) => [
    po.po_number,
    po.supplier_name ?? '',
    po.location_name ?? '',
    po.status,
    po.po_date ?? '',
    po.expected_date ?? '',
    po.total_cost != null ? po.total_cost.toFixed(2) : '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'purchase_orders.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function PurchaseOrdersLandingPage({
  purchaseOrders,
  suppliers,
  locations,
  currentFilters,
}) {
  const router = useRouter();

  return (
    <AppLayout title="Purchase Orders" showActionBar={false} bareLayout={true}>

      {/* Main card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

        {/* Tabs row — includes Export + Create PO buttons */}
        <div className="px-4 pt-3 pb-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <POTabsRow currentStatus={currentFilters.status ?? ''} />
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" onClick={() => exportCSV(purchaseOrders)}>Export</Button>
            <Button onClick={() => router.push('/purchase-orders/create')}>Create PO</Button>
          </div>
        </div>

        {/* Filters row */}
        <div className="px-4 py-3 border-b border-gray-200">
          <POFiltersRow suppliers={suppliers} locations={locations} currentFilters={currentFilters} />
        </div>

        {/* Table */}
        <POTable purchaseOrders={purchaseOrders} />

        {/* Footer count */}
        {purchaseOrders.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>

    </AppLayout>
  );
}
