import type { Metadata } from 'next';
import { NotificationsClient } from './NotificationsClient';

export const metadata: Metadata = { title: 'Notifications · Neighbr' };

export default function Page() {
  return <NotificationsClient />;
}
