'use client';
import { useState } from 'react';
import { inputClass, buttonClass } from '@/app/components/AuthShell';

export default function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    } catch { /* same message either way */ }
    setDone(true); setBusy(false);
  }

  if (done) {
    return (
      <div className="space-y-3 text-sm text-gray-700">
        <p>If an account exists for that email, a link to choose a new password is on its way. It expires in 1 hour.</p>
        <a href="/login" className="text-blue-600 hover:underline">Back to sign in</a>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <button type="submit" disabled={busy || !email} className={buttonClass}>{busy ? 'Sending…' : 'Send reset link'}</button>
      <a href="/login" className="block text-center text-sm text-blue-600 hover:underline">Back to sign in</a>
    </form>
  );
}
