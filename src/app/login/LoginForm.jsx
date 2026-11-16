'use client';
import { useState } from 'react';
import { inputClass, buttonClass } from '@/app/components/AuthShell';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.redirect) { window.location.href = json.redirect; return; }
      setError(json.error || 'Could not sign in. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !email || !password} className={buttonClass}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="flex justify-between text-sm">
        <a href="/forgot-password" className="text-blue-600 hover:underline">Forgot password?</a>
        <a href="/request-access" className="text-blue-600 hover:underline">Request beta access</a>
      </div>
    </form>
  );
}
