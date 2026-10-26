import type { Metadata } from 'next';
import { PulseClient } from './PulseClient';

export const metadata: Metadata = { title: 'Civic Pulse · Neighbr' };

export default function Page() {
  return <PulseClient />;
}
