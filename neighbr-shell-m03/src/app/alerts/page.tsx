import type { Metadata } from 'next';
import { AlertsClient } from './AlertsClient';

export const metadata: Metadata = { title: 'Alerts · Neighbr' };

export default function Page() {
  return <AlertsClient />;
}
