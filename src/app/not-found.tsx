import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <h1>That page doesn&apos;t exist</h1>
        <p>Check the address, or go back to the map.</p>
        <Link className="btn" href="/map">
          Open the map
        </Link>
      </main>
    </>
  );
}
