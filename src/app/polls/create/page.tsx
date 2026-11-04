import type { Metadata } from 'next';
import { CreatePollClient } from './CreatePollClient';

export const metadata: Metadata = { title: 'Create a poll · Neighbr' };

export default function Page() {
  return <CreatePollClient />;
}
