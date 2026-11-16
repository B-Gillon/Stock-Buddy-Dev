'use client';
export default function SignOutButton({ className = 'rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100' }) {
  async function out() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.href = '/login';
  }
  return <button type="button" onClick={out} className={className}>Sign out</button>;
}
