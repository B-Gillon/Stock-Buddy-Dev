'use client';
import { useEffect } from 'react';

export default function PrintNow() {
  useEffect(() => {
    const btn = document.getElementById('print-btn');
    const go = () => window.print();
    btn?.addEventListener('click', go);
    const t = setTimeout(go, 400);
    return () => { clearTimeout(t); btn?.removeEventListener('click', go); };
  }, []);
  return null;
}
