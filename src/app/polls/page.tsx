import type { Metadata } from 'next';
import { PollsClient } from './PollsClient';

export const metadata: Metadata = { title: 'Polls · Neighbr' };

export default function Page() {
  return <PollsClient />;
}
