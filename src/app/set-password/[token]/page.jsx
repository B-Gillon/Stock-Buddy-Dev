// src/app/set-password/[token]/page.jsx — landing page for the invite / reset email link
import { peekAuthToken } from '@/lib/auth/tokens';
import AuthShell from '@/app/components/AuthShell';
import SetPasswordForm from './SetPasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create password – Stock Buddy', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function SetPasswordPage({ params }) {
  const { token } = await params;
  const row = await peekAuthToken(token);
  if (!row) {
    return (
      <AuthShell title="This link is no longer valid">
        <p className="text-sm text-gray-700">It may have expired or already been used.</p>
        <a href="/forgot-password" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Get a new link</a>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={row.purpose === 'set_password' ? 'Create your password' : 'Choose a new password'}>
      <SetPasswordForm token={token} />
    </AuthShell>
  );
}
