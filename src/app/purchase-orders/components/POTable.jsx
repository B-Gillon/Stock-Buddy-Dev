'use client';

import { useRouter } from 'next/navigation';
import POStatusBadge from './POStatusBadge';

const TH = 'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 border-r border-gray-300 last:border-r-0';
const TD = 'px-3 py-2.5 text-sm text-gray-800 border-r border-gray-100 last:border-r-0';

// Parse date as local time to avoid UTC shift (e.g. "2026-04-29" → Apr 29, not Apr 28)
function formatDate(val) {
  if (!val) return '—';
  const str = String(val).substring(0, 10); // take YYYY-MM-DD portion only
  const [yyyy, mm, dd] = str.split('-');
  return `${mm}-${dd}-${yyyy}`;
}

export default function POTable({ purchaseOrders }) {
  const router = useRouter();

  if (!purchaseOrders?.length) {
    return (
      <div className="px-6 py-12 text-center text-sm text-gray-400">
        No purchase orders found.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse" style={{ margin: '0 16px', width: 'calc(100% - 32px)' }}>
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className={TH}>PO Number</th>
          <th className={TH}>Supplier</th>
          <th className={TH}>Location</th>
          <th className={TH} style={{ width: '130px' }}>Status</th>
          <th className={TH} style={{ width: '100px' }}>PO Date</th>
          <th className={TH} style={{ width: '140px' }}>Expected Date</th>
          <th className={TH} style={{ width: '110px' }}>Total Cost</th>
        </tr>
      </thead>
      <tbody>
        {purchaseOrders.map((po, i) => (
          <tr
            key={po.id}
            onClick={() => router.push(`/purchase-orders/${encodeURIComponent(po.po_number)}`)}
            className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
              i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <td className={TD}>{po.po_number}</td>
            <td className={TD}>{po.supplier_name ?? '—'}</td>
            <td className={TD}>{po.location_name ?? '—'}</td>
            <td className={TD} style={{ width: '130px' }}>
              <POStatusBadge status={po.status} />
            </td>
            <td className={TD} style={{ width: '100px' }}>{formatDate(po.po_date)}</td>
            <td className={TD} style={{ width: '140px' }}>{po.expected_date ? formatDate(po.expected_date) : '—'}</td>
            <td className={TD} style={{ width: '110px' }}>
              {po.total_cost != null
                ? `$${parseFloat(po.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
