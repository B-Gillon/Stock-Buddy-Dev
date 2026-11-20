'use client';
// "Upload Ship File": picks a shipment file and opens the recap screen, where nothing is created until Submit.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export const IMPORT_STORAGE_KEY = 'shipImportFile';

export default function UploadShipFile() {
  const ref = useRef(null);
  const router = useRouter();
  const [error, setError] = useState('');

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('The file is too large (2 MB maximum).'); return; }
    setError('');
    try {
      sessionStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify({ name: file.name, text: await file.text() }));
    } catch { setError('Could not read the file. Please try again.'); return; }
    router.push('/supplier-portal/shipping/import');
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <input ref={ref} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onPick} />
      <button type="button" onClick={() => ref.current?.click()}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
        Upload Ship File
      </button>
    </div>
  );
}
