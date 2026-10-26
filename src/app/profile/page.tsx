import type { Metadata } from 'next';
import { ProfileClient } from './ProfileClient';

export const metadata: Metadata = { title: 'Profile · Neighbr' };

export default function Page() {
  return <ProfileClient />;
}
