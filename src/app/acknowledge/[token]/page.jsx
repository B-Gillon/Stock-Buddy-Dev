// src/app/acknowledge/[token]/page.jsx
// Public page a supplier reaches from the emailed link. No login: the signed token is the access.
import { loadAckForToken } from '@/lib/acknowledgements';
import { signRenderStamp } from '@/lib/ackLink';
import AcknowledgeForm from './AcknowledgeForm';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Acknowledge Purchase Order',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const money = (n, cur) => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(n));
const day = (d) => {
  if (!d) return '';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${m}/${dd}/${y}`;
};

const gradientStyle = {
  background: 'linear-gradient(to right, #11E0FC, #0099FF)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="flex items-center gap-3 rounded-lg bg-gray-800 px-4 py-3 text-white shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/STOCK_BUDDY_LOGO__1_.png" alt="Stock Buddy logo" className="h-16 w-auto object-contain" />
          <div>
            <p className="text-2xl font-semibold" style={gradientStyle}>Stock Buddy</p>
            <p className="mt-0.5 text-xs" style={gradientStyle}>Inventory Management for the Modern Age</p>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Notice({ title, body }) {
  return (
    <Shell>
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {body && <p className="mt-2 text-sm text-gray-600">{body}</p>}
      </div>
    </Shell>
  );
}

export default async function AcknowledgePage({ params }) {
  const { token } = await params;
  const data = await loadAckForToken(token);

  if (data.state === 'invalid') {
    return <Notice title="This link is not valid" body="Please use the link from the most recent email, or contact the sender." />;
  }
  const { po } = data;

  if (data.state === 'cancelled') {
    return <Notice title={`Purchase Order ${po.number} has been cancelled`} body="No acknowledgement is needed." />;
  }

  return (
    <Shell>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Order details (left half) */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          {po.retailer && <p className="text-xs uppercase tracking-wide text-gray-500">{po.retailer}</p>}
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Purchase Order {po.number}</h1>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-gray-500">Supplier</dt><dd className="text-gray-900">{po.supplierName}</dd></div>
            <div><dt className="text-gray-500">PO create date</dt><dd className="text-gray-900">{day(po.date) || '—'}</dd></div>
            {po.shipTo && (
              <div>
                <dt className="text-gray-500">Ship to</dt>
                <dd className="text-gray-900">{[po.shipTo.name, ...po.shipTo.lines].filter(Boolean).map((l, i) => <span key={i} className="block">{l}</span>)}</dd>
              </div>
            )}
          </dl>
          {po.notes && (
            <div className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-700"><span className="font-medium">Notes: </span>{po.notes}</div>
          )}
        </div>

        {/* Acknowledgement (right half) */}
        {data.state === 'acknowledged' ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-900">
            <p className="text-base font-semibold">This order has been acknowledged.</p>
            <p className="mt-2">By {data.acknowledgedBy}{data.acknowledgedAt ? ` on ${new Date(data.acknowledgedAt).toLocaleDateString('en-US')}` : ''}.</p>
            <p className="mt-1">Required ship date: {day(po.requiredShipDate) || 'TBD'}</p>
            <p>Expected ship date: {day(data.expectedShipDate) || 'Not provided'}</p>
          </div>
        ) : (
          <AcknowledgeForm token={token} stamp={signRenderStamp(data.ackId)} requiredShipDate={day(po.requiredShipDate)} />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-left px-3 py-2 font-medium">Qty</th>
                <th className="text-left px-3 py-2 font-medium">Unit Cost</th>
                <th className="text-left px-3 py-2 font-medium">Extended Cost</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => (
                <tr key={l.lineNo} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{l.lineNo}</td>
                  <td className="px-3 py-2 text-gray-600">{l.sku || '—'}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{l.title || '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{l.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-800">{money(l.unitCost, po.currency)}</td>
                  <td className="px-3 py-2 text-gray-800">{money(l.extended, po.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 text-sm text-gray-800">
                <td className="px-3 py-2" colSpan={3}></td>
                <td className="px-3 py-2 font-semibold">{po.lines.reduce((n, l) => n + l.qty, 0).toLocaleString()}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 font-semibold">{money(po.total, po.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Shell>
  );
}
