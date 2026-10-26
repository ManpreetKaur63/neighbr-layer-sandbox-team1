import type { Metadata } from 'next';
import { ROUTES } from '@/lib/routes';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = { title: 'Build status · Neighbr' };

const LABEL = { built: 'Built', partial: 'Partly built', stub: 'Stub (planned)' } as const;

export default function StatusPage() {
  const counts = { built: 0, partial: 0, stub: 0 };
  ROUTES.forEach((r) => (counts[r.status] += 1));
  return (
    <>
      <SiteHeader />
      <main className="page">
        <h1>Build status</h1>
        <p>
          {ROUTES.length} required routes exist. {counts.built} built, {counts.partial} partly built and {counts.stub} planned
          stubs. Milestones M01–M05 merged into this codebase; M02 was built
          as a backfill and M05 is the latest milestone.
        </p>
        <table className="matrix">
          <caption className="sr-only">Route coverage</caption>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Family</th>
              <th scope="col">Milestone</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROUTES.map((r) => (
              <tr key={r.path}>
                <td>
                  <a href={r.path}>{r.path}</a>
                </td>
                <td>{r.family}</td>
                <td>{r.milestone}</td>
                <td>{LABEL[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
