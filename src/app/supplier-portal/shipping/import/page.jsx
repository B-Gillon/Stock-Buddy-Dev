// Recap screen for an uploaded shipment file: see what is about to happen, then Cancel or Submit.
import { requireSupplier } from '@/lib/supplierPortal';
import PortalFrame from '../../components/PortalFrame';
import ImportRecap from './ImportRecap';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review Ship File – Stock Buddy', robots: { index: false, follow: false } };

export default async function ImportPage() {
  const s = await requireSupplier();
  return (
    <PortalFrame supplierName={s.supplierName} email={s.email}>
      <ImportRecap />
    </PortalFrame>
  );
}
