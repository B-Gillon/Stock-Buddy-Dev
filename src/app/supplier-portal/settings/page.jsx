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
      {settings.allowed ? <LabelSettingsForm initial={{ ...settings, enabled: settings.wantsEnabled }} /> : (
        <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
          Carton labels (SSCC) aren’t turned on for your account. Ask your customer to enable them.
        </div>
      )}
    </PortalFrame>
  );
}
