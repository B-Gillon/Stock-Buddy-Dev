'use client';
import { useState } from 'react';
import { inputClass, buttonClass } from '@/app/components/AuthShell';

export default function SetPasswordForm({ token }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.redirect) { window.location.href = json.redirect; return; }
      setError(json.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="pw" className="block text-sm font-medium text-gray-700">New password</label>
        <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
        <p className="mt-1 text-xs text-gray-500">At least 10 characters, with a letter and a number.</p>
      </div>
      <div>
        <label htmlFor="pw2" className="block text-sm font-medium text-gray-700">Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !pw || !pw2} className={buttonClass}>{busy ? 'Saving…' : 'Save password and sign in'}</button>
    </form>
  );
}
