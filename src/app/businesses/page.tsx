import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BusinessesClient } from './BusinessesClient';

export const metadata: Metadata = { title: 'Businesses · Neighbr' };

export default function Page() {
  return (
    <Suspense>
      <BusinessesClient />
    </Suspense>
  );
}
