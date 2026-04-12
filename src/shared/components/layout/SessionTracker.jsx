'use client';
// /src/shared/components/layout/SessionTracker.jsx
// Silently records a session ping on every page load.
// Imported and rendered inside AppLayout.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SessionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Fire and forget — never block the UI
    fetch('/api/admin/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Silently swallow — session tracking must never cause errors
    });
  }, [pathname]);

  return null;
}
