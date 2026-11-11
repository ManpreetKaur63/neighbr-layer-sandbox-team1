import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = { title: 'Representative · Neighbr' };

/**
 * M07: a representative is a person, not an organization, so this is a
 * profile page, not a workspace (ADR-019). Reports in the ward go to the
 * Public Works department workspace, which assigns them and sends updates
 * back to the person who reported.
 */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>Institutional</p>
        <h1>Sample Ward 3 Councillor (demo)</h1>
        <p className="lede">
          A representative is a person, not an organization. This is a profile page, not a workspace.
          Everything here is invented demo data; no real person is listed.
        </p>
        <section className="card" aria-label="Representative">
          <h2 style={{ marginTop: 0 }}>Demo Councillor — Ward 3, Riverside</h2>
          <p className="muted">Office hours: weekdays, demo only.</p>
          <p className="muted">
            Reports about roads, streetlights and waste in this ward go to the Public Works department,
            which assigns them to a named staff member and sends updates back to the person who reported.
          </p>
          <div className="btn-row">
            <Link className="btn" href="/government?ws=ws-gov-public-works">Open the Public Works workspace</Link>
            <Link className="btn secondary" href="/issues/report">Report an issue</Link>
          </div>
        </section>
        <p className="notice">
          M07 decision: representatives do not get workspaces. Their department does.
        </p>
      </main>
    </>
  );
}
