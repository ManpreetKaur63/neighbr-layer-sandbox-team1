import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { ROUTE_KINDS } from '@/lib/workspace-config';

export const metadata: Metadata = { title: 'Public office and department workspace \u00b7 Neighbr' };

/**
 * M07: serves public offices and government departments from the same reusable shell (like /institution serves
 * schools). `?ws=` picks the tenant, `?tab=` opens a tab, e.g. `?ws=ws-ward-sample&tab=public`.
 */
export default function Page() {
  return (
    <Suspense>
      <WorkspaceClient kind="office" kinds={ROUTE_KINDS['/representative']} />
    </Suspense>
  );
}
