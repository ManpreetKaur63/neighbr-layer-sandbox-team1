import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MessagesClient } from './MessagesClient';

export const metadata: Metadata = { title: 'Messages · Neighbr' };

export default function Page() {
  return (
    <Suspense>
      <MessagesClient />
    </Suspense>
  );
}
