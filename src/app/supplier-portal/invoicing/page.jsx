import { requireSupplier } from '@/lib/supplierPortal';
import PortalFrame from '../components/PortalFrame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invoicing – Stock Buddy', robots: { index: false, follow: false } };

export default async function Page() {
  const s = await requireSupplier();
  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Invoicing</h2>
        <p className="mt-2 text-sm text-gray-600">Invoice your shipments here. This section is coming next.</p>
      </section>
    </PortalFrame>
  );
}
