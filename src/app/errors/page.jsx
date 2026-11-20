// /src/app/errors/page.jsx
import { headers } from 'next/headers';
import { getTenantIdFromHeaders } from '@/lib/tenants';
import { loadErrors } from '@/lib/errorsList';
import ErrorsClient from './components/ErrorsClient';

export const dynamic = 'force-dynamic';

export default async function ErrorsPage() {
  const tenantId = await getTenantIdFromHeaders(await headers());
  return <ErrorsClient initialErrors={await loadErrors(tenantId)} />;
}
