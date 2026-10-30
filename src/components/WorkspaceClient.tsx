'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StateBoundary } from './StateBoundary';
import { WorkspaceShell, WORKSPACE_TABS, type WorkspaceTab } from './WorkspaceShell';
import { resetSessionServices } from '@/services/session';
import { useServices } from '@/services/use-services';
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
  const requestedTab = searchParams.get('tab');
  const initialTab: WorkspaceTab = WORKSPACE_TABS.some((t) => t.id === requestedTab) ? (requestedTab as WorkspaceTab) : 'overview';
  const services = useServices();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [siblings, setSiblings] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [offers, setOffers] = useState<WorkspaceOffer[]>([]);
  const [objects, setObjects] = useState<CivicObject[]>([]);
  const [cityName, setCityName] = useState('');
  const [boundaryName, setBoundaryName] = useState('');
  const [outsideBusinesses, setOutsideBusinesses] = useState(0);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
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
      // A BIA only ever sees what is inside its own boundary. Businesses elsewhere in the city are
      // counted (so the screen can say what is left out) but never listed.
      const boundaryId = chosen.kind === 'bia' ? chosen.boundaryId : undefined;
      const [m, t, o, cities, objs, cityBusinesses, boundary] = await Promise.all([
        services.workspaces.members(chosen.id),
        services.workspaces.tasks(chosen.id),
        services.workspaces.offers(chosen.id),
        services.cities.list(),
        services.objects.list({ cityId: chosen.cityId, boundaryId }),
        boundaryId ? services.objects.list({ cityId: chosen.cityId, kinds: ['business'] }) : Promise.resolve([]),
        boundaryId ? services.boundaries.get(boundaryId) : Promise.resolve(null),
      ]);
      setWorkspace(chosen);
      setSiblings(ofKind);
      setMembers(m);
      setTasks(t);
      setOffers(o);
      setCityName(cities.find((c) => c.id === chosen.cityId)?.name ?? chosen.cityId);
      setObjects(objs);
      setBoundaryName(boundary?.properties.name ?? '');
      setOutsideBusinesses(
        boundaryId ? cityBusinesses.filter((b) => !objs.some((x) => x.id === b.id)).length : 0,
      );
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
  const signals = objects.filter((o) => o.kind === 'issue');
  const openSignals = signals.filter((o) => !o.handledBy && o.status !== 'Resolved');
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
                {kind === 'bia' && <span className="pill">{openSignals.length} new community signals</span>}
                <span className="pill">{openTasks.length} open tasks</span>
                <span className="pill">{publishedOffers.length} published offers</span>
              </div>
              <p className="muted">
                {kind === 'bia'
                  ? `Directory for ${boundaryName || cityName}: ${listings.length} businesses and places inside the boundary, ${events.length} events and a work queue of ${tasks.length} tasks. ${outsideBusinesses} ${outsideBusinesses === 1 ? 'business' : 'businesses'} elsewhere in ${cityName} ${outsideBusinesses === 1 ? 'is' : 'are'} outside this boundary and not listed.`
                  : `Your claimed listings in ${cityName}: ${claimed.length}. Unclaimed businesses in the same city can be claimed from the Listings tab.`}
              </p>
              {kind === 'bia' && (
                <SignalLoop
                  tasks={tasks}
                  signals={signals}
                  onAdvance={(id, status) => act(() => services.workspaces.updateTask(workspace.id, id, status), 'Task updated. The community issue and the reporter\u2019s notifications were updated too.')}
                  onOpenSignals={() => setTab('signals')}
                />
              )}
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
              {kind === 'bia' && (
                <p className="muted">
                  Only businesses and places inside {boundaryName || 'this BIA\u2019s boundary'} are listed:{' '}
                  {listings.length} shown, {outsideBusinesses} {outsideBusinesses === 1 ? 'business' : 'businesses'} elsewhere in{' '}
                  {cityName} left out.
                </p>
              )}
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
              <h2>Events in {kind === 'bia' ? boundaryName || cityName : cityName}</h2>
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

          {tab === 'signals' && kind === 'bia' && (
            <section aria-label="Community signals">
              <h2>Community signals</h2>
              <p className="muted">
                Issues reported by neighbours inside {boundaryName || 'this BIA\u2019s boundary'}. Taking one on creates a task in
                the work queue, tells the reporter, and carries every later step back to the issue on the map. Issues
                outside the boundary never appear here.
              </p>
              {signals.map((o) => {
                const task = tasks.find((t) => t.id === o.handledBy?.taskId);
                return (
                  <article className="card" key={o.id} aria-label={`Signal: ${o.title}`}>
                    <h3 style={{ margin: '0 0 4px' }}>{o.title}</h3>
                    <p className="muted" style={{ margin: '0 0 8px' }}>{o.summary} · {o.status}</p>
                    {task && <p className="muted" style={{ margin: '0 0 8px' }}>BIA task: “{task.title}” — {task.status}</p>}
                    <div className="btn-row">
                      {!o.handledBy && o.status !== 'Resolved' && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => act(() => services.workspaces.raiseTaskFromIssue(workspace.id, o.id), 'Issue taken on as a task. The reporter was notified.')}
                        >
                          Take on as a task
                        </button>
                      )}
                      {task && task.status !== 'done' && (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() =>
                            act(() => services.workspaces.updateTask(workspace.id, task.id, task.status === 'open' ? 'in-progress' : 'done'), 'Task updated. The issue on the map was updated too.')
                          }
                        >
                          {NEXT_TASK_LABEL[task.status]}
                        </button>
                      )}
                      <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
                    </div>
                  </article>
                );
              })}
              {signals.length === 0 && <p className="muted">No community issues inside this boundary right now.</p>}
            </section>
          )}

          {tab === 'tasks' && (
            <section aria-label="Tasks">
              <h2>Work queue</h2>
              <p className="muted">Tasks move one step forward only: open → in progress → done. Done tasks cannot move back.</p>
              {tasks.map((t) => (
                <article className="card" key={t.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{t.title}</h3>
                  <p className="muted" style={{ margin: '0 0 8px' }}>
                    {t.kind} · {t.status}
                    {t.sourceObjectId && (
                      <>
                        {' · '}
                        <Link href={mapHref(t.sourceObjectId)}>raised from a community issue</Link>
                      </>
                    )}
                  </p>
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
 * The signal loop (M05 WP4), now driven by real state: community issue -> BIA task -> outcome.
 * Each row reads the live issue and task, so whatever happened on another screen (a new
 * report, a task moved forward) shows here, and what happens here shows on the map, in the
 * reporter's notifications and in the Pulse feed.
 */
function SignalLoop({
  tasks,
  signals,
  onAdvance,
  onOpenSignals,
}: {
  tasks: WorkspaceTask[];
  signals: CivicObject[];
  onAdvance: (id: string, status: TaskStatus) => void;
  onOpenSignals: () => void;
}) {
  const linked = tasks
    .map((task) => ({ task, issue: signals.find((s) => s.id === task.sourceObjectId) }))
    .filter((x): x is { task: WorkspaceTask; issue: CivicObject } => x.issue !== undefined);
  const waiting = signals.filter((s) => !s.handledBy && s.status !== 'Resolved');
  return (
    <section aria-label="Signal loop" className="card">
      <h3 style={{ marginTop: 0 }}>Signal loop: community → BIA → outcome</h3>
      {waiting.length > 0 && (
        <p>
          <strong>{waiting.length}</strong> new community {waiting.length === 1 ? 'signal is' : 'signals are'} waiting:{' '}
          {waiting.map((w) => w.title).join('; ')}.{' '}
          <button type="button" className="pill" onClick={onOpenSignals}>Review community signals</button>
        </p>
      )}
      {linked.length === 0 && <p className="muted">No community issue has been taken on yet.</p>}
      {linked.map(({ task, issue }) => (
        <div key={task.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <ol>
            <li>
              Community signal: <Link href={mapHref(issue.id)}>{issue.title}</Link> — now “{issue.status}”.
            </li>
            <li>BIA action: “{task.title}” — {task.status}.</li>
            <li>
              {issue.outcome ? (
                <>
                  Outcome published: {issue.outcome.summary} <Link href={mapHref(issue.id)}>See it on the map</Link>.
                </>
              ) : (
                'Outcome: nothing published yet. Move the task to done and the outcome appears on the issue.'
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
        </div>
      ))}
      <p className="muted" style={{ marginBottom: 0 }}>
        Demo session data lasts for this browser tab.{' '}
        <button
          type="button"
          className="pill"
          onClick={() => {
            resetSessionServices();
            window.location.reload();
          }}
        >
          Reset demo data
        </button>
      </p>
    </section>
  );
}
