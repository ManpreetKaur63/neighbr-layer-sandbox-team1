import Link from 'next/link';
import { findRoute } from '@/lib/routes';
import { StateBoundary } from './StateBoundary';
import { SiteHeader } from './SiteHeader';

/**
 * Placeholder for routes that are required but not built yet. It exists so deep links, navigation
 * and the route coverage matrix are real from day one, and it shows the shared "restricted" and
 * "empty" states in the same wording the finished screens will use.
 */
export function RouteStub({ path }: { path: string }) {
  const route = findRoute(path);
  if (!route) throw new Error(`Route ${path} is not in the route inventory.`);
  const restricted = route.family === 'Administration';

  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>{route.family}</p>
        <h1>{route.title}</h1>
        <p>{route.summary}</p>
        <StateBoundary
          state={restricted ? 'restricted' : 'empty'}
          restrictedTitle="Operations staff only"
          restrictedHelp="Sign-in and role checks arrive in milestone M02. Until then this area stays closed."
          emptyTitle={`Not built yet. Planned for ${route.milestone}.`}
          emptyHelp="This page exists so links and deep links work today. It will be filled in during its milestone."
        />
        <div className="btn-row">
          <Link className="btn" href="/map">
            Open the map
          </Link>
          <Link className="btn secondary" href="/status">
            See build status
          </Link>
        </div>
      </main>
    </>
  );
}
