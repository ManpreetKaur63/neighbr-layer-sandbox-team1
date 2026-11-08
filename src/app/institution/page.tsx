import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { ROUTE_KINDS } from '@/lib/workspace-config';

export const metadata: Metadata = { title: 'Institution workspace · Neighbr' };

/** M06: serves institutions and schools from the same reusable shell; `?ws=` picks the tenant. */
export default function Page() {
  return (
    <Suspense>
      <WorkspaceClient kind="institution" kinds={ROUTE_KINDS['/institution']} />
    </Suspense>
  );
}
