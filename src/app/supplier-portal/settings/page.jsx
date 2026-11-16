import { requireSupplier } from '@/lib/supplierPortal';
import { loadLabelSettings } from '@/lib/sscc';
import PortalFrame from '../components/PortalFrame';
import LabelSettingsForm from './LabelSettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings – Stock Buddy', robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const s = await requireSupplier();
  const settings = await loadLabelSettings(s.tenantId, s.supplierId);
  return (
    <PortalFrame active="settings" supplierName={s.supplierName} email={s.email}>
      <LabelSettingsForm initial={settings} />
    </PortalFrame>
  );
}
