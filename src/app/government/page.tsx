import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { ROUTE_KINDS } from '@/lib/workspace-config';

export const metadata: Metadata = { title: 'Government department workspace · Neighbr' };

/** M07: serves public office and government department tenants from the same reusable shell; `?ws=` picks the tenant. */
export default function Page() {
  return (
    <Suspense>
      <WorkspaceClient kind="government" kinds={ROUTE_KINDS['/government']} />
    </Suspense>
  );
}
