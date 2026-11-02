import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceClient } from '@/components/WorkspaceClient';

export const metadata: Metadata = { title: 'Organization workspace · Neighbr' };

/** M06: community organizations and NGOs, rendered by the same reusable shell. */
export default function Page() {
  return (
    <Suspense>
      <WorkspaceClient kind="organization" />
    </Suspense>
  );
}
