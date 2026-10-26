import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkspaceClient } from '@/components/WorkspaceClient';

export const metadata: Metadata = { title: 'Business workspace · Neighbr' };

export default function Page() {
  return (
    <Suspense>
      <WorkspaceClient kind="business" />
    </Suspense>
  );
}
