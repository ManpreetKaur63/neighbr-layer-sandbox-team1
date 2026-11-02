import type { Metadata } from 'next';
import { ReportIssueClient } from './ReportIssueClient';

export const metadata: Metadata = { title: 'Report an issue · Neighbr' };

export default function Page() {
  return <ReportIssueClient />;
}
