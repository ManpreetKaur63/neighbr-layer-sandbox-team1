'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StateBoundary } from './StateBoundary';
import { WorkspaceShell, type WorkspaceTab } from './WorkspaceShell';
import { createMockServices } from '@/services/mock';
import { mapHref, workspaceHrefForObject } from '@/lib/workspace';
import type {
  CivicObject,
  TaskStatus,
  Workspace,
  WorkspaceKind,
  WorkspaceMember,
  WorkspaceOffer,
  WorkspaceTask,
} from '@/lib/schemas';

const NEXT_TASK_LABEL: Record<Exclude<TaskStatus, 'done'>, string> = {
  open: 'Start task',
  'in-progress': 'Mark done',
};

/**
 * M05 tenant workspace, shared by /bia and /business. One component, one
 * service port, six views: overview dashboard, members, listings (with
 * claim), offers (draft -> publish, gated on verification), events and the
 * work queue. Every listing and event links back to its pin on the shared
 * map; the map detail panel links back here for owned records.
 */
export function WorkspaceClient({ kind }: { kind: WorkspaceKind }) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('ws');
  const services = useMemo(() => createMockServices(), []);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [siblings, setSiblings] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [offers, setOffers] = useState<WorkspaceOffer[]>([]);
  const [objects, setObjects] = useState<CivicObject[]>([]);
  const [cityName, setCityName] = useState('');
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerSummary, setOfferSummary] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await services.workspaces.workspaces();
      const ofKind = all.filter((w) => w.kind === kind);
      const chosen = requestedId ? ofKind.find((w) => w.id === requestedId) ?? null : ofKind[0] ?? null;
      if (!chosen) {
        setNotFound(true);
        return;
      }
      const [m, t, o, cities, objs] = await Promise.all([
        services.workspaces.members(chosen.id),
        services.workspaces.tasks(chosen.id),
        services.workspaces.offers(chosen.id),
        services.cities.list(),
        services.objects.list({ cityId: chosen.cityId }),
      ]);
      setWorkspace(chosen);
      setSiblings(ofKind);
      setMembers(m);
      setTasks(t);
      setOffers(o);
      setCityName(cities.find((c) => c.id === chosen.cityId)?.name ?? chosen.cityId);
      setObjects(objs);
    } catch {
      setFailed(true);
    }
  }, [kind, requestedId, services]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  const listings = objects.filter((o) => o.kind === 'business' || o.kind === 'place');
  const claimed = workspace ? listings.filter((o) => o.workspaceId === workspace.id) : [];
  const claimable = workspace
    ? objects.filter((o) => o.kind === 'business' && !o.workspaceId)
    : [];
  const events = objects.filter((o) => o.kind === 'event');
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const publishedOffers = offers.filter((o) => o.status === 'published');

  async function act(fn: () => Promise<unknown>, ok: string) {
    setNotice(null);
    setError(null);
    try {
      await fn();
      await load();
      setNotice(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  }

  const state = failed ? 'error' : notFound ? 'error' : workspace === null ? 'loading' : 'success';

  return (
    <StateBoundary
      state={state}
      loadingLabel="Loading the workspace…"
      errorTitle={notFound ? 'Workspace not found' : 'Workspace unavailable'}
      errorHelp={
        notFound
          ? 'No workspace of this kind has that id in the demo data. Go back to the first workspace of this kind.'
          : 'Could not load the workspace. Try again — no real data is affected.'
      }
      onRetry={() => {
        setFailed(false);
        setNotFound(false);
        void load();
      }}
    >
      {workspace && (
        <WorkspaceShell workspace={workspace} siblings={siblings} activeTab={tab} onTabChange={setTab}>
          {notice && <p className="notice" role="status">{notice}</p>}
          {error && <p role="alert" className="muted">{error}</p>}

          {tab === 'overview' && (
            <section aria-label="Dashboard">
              <h2>Dashboard</h2>
              <div className="pill-row">
                <span className="pill">{members.length} members</span>
                <span className="pill">{kind === 'bia' ? listings.length : claimed.length} listings</span>
                <span className="pill">{openTasks.length} open tasks</span>
                <span className="pill">{publishedOffers.length} published offers</span>
              </div>
              <p className="muted">
                {kind === 'bia'
                  ? `Corridor directory for ${cityName}: ${listings.length} listings and places, ${events.length} events, and a work queue of ${tasks.length} tasks.`
                  : `Your claimed listings in ${cityName}: ${claimed.length}. Unclaimed businesses in the same city can be claimed from the Listings tab.`}
              </p>
              {kind === 'bia' && <SignalLoop tasks={tasks} onAdvance={(id, status) => act(() => services.workspaces.updateTask(workspace.id, id, status), 'Task updated.')} />}
              <div className="btn-row">
                <Link className="btn secondary" href="/map">Open the map</Link>
                <Link className="btn secondary" href="/businesses">Business directory</Link>
              </div>
            </section>
          )}

          {tab === 'members' && (
            <section aria-label="Members">
              <h2>Members</h2>
              <p className="muted">
                Who can do what in this workspace: owners manage members, tasks and offers; staff work on tasks
                and offers; members view. Role checks are display-only in this shell — a production workspace
                service enforces them. Names below are demo names, not real people.
              </p>
              {members.map((m) => (
                <article className="card" key={m.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{m.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {m.role} · {m.status === 'active' ? 'Active' : 'Invited, not yet active'}
                  </p>
                </article>
              ))}
            </section>
          )}

          {tab === 'listings' && (
            <section aria-label="Listings">
              <h2>{kind === 'bia' ? 'Corridor listings' : 'Your listings'}</h2>
              {(kind === 'bia' ? listings : claimed).map((o) => (
                <ListingCard key={o.id} object={o} />
              ))}
              {(kind === 'bia' ? listings : claimed).length === 0 && (
                <p className="muted">No listings yet. Claim one below.</p>
              )}
              {kind === 'business' && claimable.length > 0 && (
                <>
                  <h3>Claim a listing</h3>
                  <p className="muted">
                    Unclaimed businesses in {cityName}. Claiming moves a listing into this workspace; a listing
                    already claimed by another workspace cannot be claimed again.
                  </p>
                  {claimable.map((o) => (
                    <article className="card" key={o.id}>
                      <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
                      <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary}</p>
                      <div className="btn-row">
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => act(() => services.workspaces.claimListing(workspace.id, o.id), 'Listing claimed into this workspace.')}
                        >
                          Claim this listing
                        </button>
                        <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </section>
          )}

          {tab === 'offers' && (
            <section aria-label="Offers">
              <h2>Offers</h2>
              <p className="muted">
                Drafts stay inside the workspace. Only published offers are public, and only a verified
                workspace can publish.
              </p>
              {offers.map((o) => (
                <article className="card" key={o.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
                  <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary}</p>
                  <p className="muted" style={{ margin: '0 0 8px' }}>Status: {o.status}</p>
                  <div className="btn-row">
                    {o.status === 'draft' && (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={workspace.status !== 'verified'}
                        onClick={() => act(() => services.workspaces.publishOffer(o.id), 'Offer published.')}
                      >
                        Publish offer
                      </button>
                    )}
                    <Link className="btn secondary" href={mapHref(o.businessId)}>📍 View business on map</Link>
                  </div>
                </article>
              ))}
              <h3>Create a draft offer</h3>
              <div style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
                <input
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  placeholder="Offer title"
                  aria-label="Offer title"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <input
                  value={offerSummary}
                  onChange={(e) => setOfferSummary(e.target.value)}
                  placeholder="Short description (optional)"
                  aria-label="Offer description"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={claimed.length === 0 && listings.filter((o) => o.kind === 'business').length === 0}
                  onClick={() => {
                    const businessId = (claimed[0] ?? listings.find((o) => o.kind === 'business'))?.id;
                    if (!businessId) return;
                    void act(
                      () => services.workspaces.createOffer({ workspaceId: workspace.id, businessId, title: offerTitle, summary: offerSummary }),
                      'Draft offer created.',
                    );
                    setOfferTitle('');
                    setOfferSummary('');
                  }}
                >
                  Create draft
                </button>
              </div>
            </section>
          )}

          {tab === 'events' && (
            <section aria-label="Events">
              <h2>Events in {cityName}</h2>
              <p className="muted">Events the workspace can promote or staff. Each one links to its map pin.</p>
              {events.map((o) => (
                <article className="card" key={o.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
                  <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary} · {o.status}</p>
                  <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
                </article>
              ))}
              {events.length === 0 && <p className="muted">No events in the demo data for this city.</p>}
            </section>
          )}

          {tab === 'tasks' && (
            <section aria-label="Tasks">
              <h2>Work queue</h2>
              <p className="muted">Tasks move one step forward only: open → in progress → done. Done tasks cannot move back.</p>
              {tasks.map((t) => (
                <article className="card" key={t.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{t.title}</h3>
                  <p className="muted" style={{ margin: '0 0 8px' }}>{t.kind} · {t.status}</p>
                  {t.status !== 'done' && (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        act(
                          () => services.workspaces.updateTask(workspace.id, t.id, t.status === 'open' ? 'in-progress' : 'done'),
                          'Task updated.',
                        )
                      }
                    >
                      {NEXT_TASK_LABEL[t.status]}
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}
        </WorkspaceShell>
      )}
    </StateBoundary>
  );
}

function ListingCard({ object }: { object: CivicObject }) {
  const workspaceLink = workspaceHrefForObject(object);
  return (
    <article className="card">
      <h3 style={{ margin: '0 0 4px' }}>{object.title}</h3>
      <p className="muted" style={{ margin: '0 0 8px' }}>{object.summary} · {object.status}</p>
      <div className="btn-row">
        <Link className="btn secondary" href={mapHref(object.id)}>📍 View on map</Link>
        {workspaceLink && <Link className="btn secondary" href={workspaceLink}>Open in workspace</Link>}
        {!workspaceLink && <span className="muted">Not claimed yet</span>}
      </div>
    </article>
  );
}

/**
 * Bounded BIA–Business–community signal loop (M05 WP4), traced, not invented:
 * community issue -> BIA work-queue task -> published demo outcome. The outcome
 * card appears only once the task is actually marked done in this session.
 */
function SignalLoop({ tasks, onAdvance }: { tasks: WorkspaceTask[]; onAdvance: (id: string, status: TaskStatus) => void }) {
  const task = tasks.find((t) => t.id === 't-bia-works');
  if (!task) return null;
  return (
    <section aria-label="Signal loop" className="card">
      <h3 style={{ marginTop: 0 }}>Signal loop: community → BIA → outcome</h3>
      <ol>
        <li>
          Community signal: <Link href={mapHref('w-roadworks')}>Roadworks affecting shop access</Link> (issue on the map).
        </li>
        <li>Workspace action: “{task.title}” — currently {task.status}.</li>
        <li>
          {task.status === 'done' ? (
            <>Demo outcome published: shops notified — see the market alert on the <Link href={mapHref('w-alert-market')}>map</Link>.</>
          ) : (
            'Outcome slot: nothing published yet. Mark the task done in the Tasks tab and this outcome appears.'
          )}
        </li>
      </ol>
      {task.status !== 'done' && (
        <button
          type="button"
          className="btn secondary"
          onClick={() => onAdvance(task.id, task.status === 'open' ? 'in-progress' : 'done')}
        >
          {NEXT_TASK_LABEL[task.status]}
        </button>
      )}
    </section>
  );
}
