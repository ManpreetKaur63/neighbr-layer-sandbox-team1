import type { Metadata } from 'next';
import { SettingsClient } from './SettingsClient';

export const metadata: Metadata = { title: 'Settings · Neighbr' };

export default function Page() {
  return <SettingsClient />;
}
