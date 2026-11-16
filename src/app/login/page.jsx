// src/app/login/page.jsx — website sign-in (retailers and suppliers)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, readSessionValue } from '@/lib/auth/session';
import AuthShell from '@/app/components/AuthShell';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in – Stock Buddy', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const s = readSessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  if (s) redirect(s.role === 'supplier' ? '/supplier-portal' : '/dashboard');
  return (
    <AuthShell title="Sign in">
      <LoginForm />
    </AuthShell>
  );
}
