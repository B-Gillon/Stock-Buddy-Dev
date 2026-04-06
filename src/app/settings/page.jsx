import { supabase } from '@/lib/supabaseClient';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('id, supplier_name')
    .order('supplier_name');

  console.log("Settings suppliers:", suppliers, suppliersError);

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .order('name');

  return (
    <SettingsClient
      suppliers={suppliers || []}
      locations={locations || []}
    />
  );
}