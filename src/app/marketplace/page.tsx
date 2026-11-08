import type { Metadata } from 'next';
import { MarketplaceClient } from './MarketplaceClient';

export const metadata: Metadata = { title: 'Marketplace · Neighbr' };

export default function Page() {
  return <MarketplaceClient />;
}
