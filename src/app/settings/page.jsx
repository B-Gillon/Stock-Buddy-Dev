// /src/app/settings/page.jsx

import { supabase } from '@/lib/supabaseClient';
import SettingsClient from './components/SettingsClient';

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_name')
    .order('supplier_name');

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .order('name');

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['po_next_number', 'po_format']);

  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const poNextNumber = settings.po_next_number ?? null;

  return (
    <SettingsClient
      suppliers={suppliers || []}
      locations={locations || []}
      poNextNumber={poNextNumber}
    />
  );
}
