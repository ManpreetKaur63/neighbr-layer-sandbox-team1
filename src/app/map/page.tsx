import type { Metadata } from 'next';
import { MapShell } from '@/features/map/MapShell';

export const metadata: Metadata = { title: 'Map · Neighbr' };

export default function MapPage() {
  return <MapShell />;
}
