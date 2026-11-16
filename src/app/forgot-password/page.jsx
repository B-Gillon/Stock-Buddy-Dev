import AuthShell from '@/app/components/AuthShell';
import ForgotForm from './ForgotForm';

export const metadata = { title: 'Reset password – Stock Buddy', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password">
      <ForgotForm />
    </AuthShell>
  );
}
