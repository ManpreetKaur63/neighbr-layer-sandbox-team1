import type { Metadata } from 'next';
import { EventsClient } from './EventsClient';

export const metadata: Metadata = { title: 'Events · Neighbr' };

export default function Page() {
  return <EventsClient />;
}
