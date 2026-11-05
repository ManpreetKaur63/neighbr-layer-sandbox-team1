import type { Metadata } from 'next';
<<<<<<< HEAD
=======
import { Suspense } from 'react';
>>>>>>> 097e8d177c60125dbf39b50b1d33d0c88ededa45
import { BusinessesClient } from './BusinessesClient';

export const metadata: Metadata = { title: 'Businesses · Neighbr' };

export default function Page() {
<<<<<<< HEAD
  return <BusinessesClient />;
=======
  return (
    <Suspense>
      <BusinessesClient />
    </Suspense>
  );
>>>>>>> 097e8d177c60125dbf39b50b1d33d0c88ededa45
}
