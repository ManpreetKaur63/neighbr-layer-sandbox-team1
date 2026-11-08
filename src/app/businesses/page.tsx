import type { Metadata } from 'next';
import { BusinessesClient } from './BusinessesClient';

export const metadata: Metadata = { title: 'Businesses · Neighbr' };

export default function Page() {
  return <BusinessesClient />;
}
