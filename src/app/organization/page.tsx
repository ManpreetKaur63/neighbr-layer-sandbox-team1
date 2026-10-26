import type { Metadata } from 'next';
import { RouteStub } from '@/components/RouteStub';

export const metadata: Metadata = { title: "Organization workspace \u00b7 Neighbr" };

export default function Page() {
  return <RouteStub path="/organization" />;
}
