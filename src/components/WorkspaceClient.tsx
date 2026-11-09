'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StateBoundary } from './StateBoundary';
import { WorkspaceShell } from './WorkspaceShell';
import { RequestQueue } from './RequestQueue';
import { createMockServices } from '@/services/mock';
import type { HandlerActor } from '@/services/ports';
import { mapHref, workspaceHrefForObject } from '@/lib/workspace';
import { KIND_CONFIG, usesPrograms, type WorkspaceTab } from '@/lib/workspace-config';
import { PERMISSION_ACTIONS, decide, type ActorContext, type PermissionAction, type PermissionDecision } from '@/lib/permissions';
import { getOnboardingRole, resolveActor, roleDef, type OnboardingRole } from '@/lib/session';
import { STATUS_LABEL } from '@/lib/requests';
import { pointInPolygon } from '@/lib/geo';
import type {
  BoundaryFeature,
  CivicObject,
  CivicRequest,
  MemberRole,
  TaskStatus,
  Workspace,
  WorkspaceKind,
  WorkspaceMember,
  WorkspaceOffer,
  WorkspaceProgram,
  WorkspaceTask,
} from '@/lib/schemas';

const NEXT_TASK_LABEL: Record<Exclude<TaskStatus, 'done'>, string> = {
  open: 'Start task',
  'in-progress': 'Mark done',
};

const ROLE_IDS: MemberRole[] = ['owner', 'staff', 'member'];

/**
 * Tenant workspace, shared by /bia, /business (M05) and /institution,
 * /organization (M06). One component, one service port, one shell. Which
 * tabs, wording and role names appear comes from `KIND_CONFIG`; which
 * actions are allowed comes from the shared `decide` rule, which the port
 * also enforces. A route may serve several kinds (`/institution` serves
 * institutions and schools): pass `kinds`, or just `kind` for one.
 */
export function WorkspaceClient({ kind, kinds }: { kind: WorkspaceKind; kinds?: WorkspaceKind[] }) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('ws');
  const servedKey = (kinds ?? [kind]).join(',');
  const services = useMemo(() => createMockServices(), []);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [siblings, setSiblings] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [offers, setOffers] = useState<WorkspaceOffer[]>([]);
  const [programs, setPrograms] = useState<WorkspaceProgram[]>([]);
  const [requests, setRequests] = useState<CivicRequest[]>([]);
  const [objects, setObjects] = useState<CivicObject[]>([]);
  const [area, setArea] = useState<BoundaryFeature | null>(null);
  // M07: who acts here comes from onboarding (the role chosen at signup), not
  // from a switch on this page. The server renders the default (resident);
  // the client reads the session role on mount, and nothing role-dependent
  // renders until the workspace has loaded.
  const [persona] = useState<OnboardingRole>(() => getOnboardingRole());
  const [programTitle, setProgramTitle] = useState('');
  const [programSummary, setProgramSummary] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
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
      const served = servedKey.split(',');
      const ofKind = all.filter((w) => served.includes(w.kind));
      const chosen = requestedId ? ofKind.find((w) => w.id === requestedId) ?? null : ofKind[0] ?? null;
      if (!chosen) {
        setNotFound(true);
        return;
      }
      const [m, t, o, pr, cities, objs, reqs, bounds] = await Promise.all([
        services.workspaces.members(chosen.id),
        services.workspaces.tasks(chosen.id),
        services.workspaces.offers(chosen.id),
        services.workspaces.programs(chosen.id),
        services.cities.list(),
        services.objects.list({ cityId: chosen.cityId }),
        services.requests.list({ workspaceId: chosen.id }),
        services.boundaries.listForCity(chosen.cityId),
      ]);
      setWorkspace(chosen);
      setSiblings(ofKind);
      setMembers(m);
      setTasks(t);
      setOffers(o);
      setPrograms(pr);
      setRequests(reqs);
      setCityName(cities.find((c) => c.id === chosen.cityId)?.name ?? chosen.cityId);
      setObjects(objs);
      setArea(chosen.boundaryId ? (bounds.features.find((f) => f.properties.id === chosen.boundaryId) ?? null) : null);
    } catch {
      setFailed(true);
    }
  }, [servedKey, requestedId, services]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await load();
    })();
    return () => {
      live = false;
    };
  }, [load]);

  const kindOfWorkspace: WorkspaceKind = workspace?.kind ?? kind;
  const config = KIND_CONFIG[kindOfWorkspace];
  const programKind = usesPrograms(kindOfWorkspace);
  // A workspace with a boundary (a BIA) works inside it: its directory, events and counts exclude the rest of the city.
  // If the boundary cannot be found, fail closed (show nothing) instead of showing the whole city.
  const bounded = workspace?.boundaryId !== undefined;
  const scoped = bounded
    ? objects.filter((o) => (area ? pointInPolygon(o.geo.coordinates, area.geometry.coordinates) : false))
    : objects;
  const cityListingCount = objects.filter((o) => o.kind === 'business' || o.kind === 'place').length;
  const listings = scoped.filter((o) => o.kind === 'business' || o.kind === 'place');
  const claimed = workspace ? listings.filter((o) => o.workspaceId === workspace.id) : [];
  const claimable = workspace
    ? objects.filter((o) => o.kind === 'business' && !o.workspaceId)
    : [];
  const events = scoped.filter((o) => o.kind === 'event');
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const openRequests = requests.filter((r) => r.status !== 'declined' && r.status !== 'resolved');
  const publishedOffers = offers.filter((o) => o.status === 'published');
  const publishedPrograms = programs.filter((p) => p.status === 'published');
  const draftPrograms = programs.filter((p) => p.status === 'draft');

  // Who the page is shown as: the onboarded role, resolved to a member of
  // *this* workspace. A resident is not a member anywhere, so they act with
  // the least privilege (view only). With no members at all, same fallback.
  const actor = resolveActor(persona, members);
  const personaDef = roleDef(persona);
  const actorContext: ActorContext = actor
    ? { role: actor.role, memberStatus: actor.status }
    : { role: 'member', memberStatus: 'active' };
  const handlerActor: HandlerActor = { ...actorContext, name: actor?.name ?? personaDef.label };
  const can = (action: PermissionAction): PermissionDecision =>
    workspace ? decide(action, actorContext, workspace.status) : { allowed: false, reason: 'No workspace is loaded.' };

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
  const activeTab: WorkspaceTab = config.tabs.some((t) => t.id === tab) ? tab : 'overview';
  const viewBlocked = !can('view').allowed;

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
        <WorkspaceShell
          workspace={workspace}
          siblings={siblings}
          activeTab={activeTab}
          onTabChange={setTab}
        >
          {notice && <p className="notice" role="status">{notice}</p>}
          {error && <p role="alert" className="muted">{error}</p>}

          {viewBlocked && (
            <StateBoundary
              state="restricted"
              restrictedTitle="No access yet"
              restrictedHelp={`${can('view').reason} Your role was set when you signed up — change it in Settings, or ask the workspace owner.`}
            />
          )}

          {!viewBlocked && activeTab === 'overview' && (
            <section aria-label="Dashboard">
              <h2>Dashboard</h2>
              <div className="pill-row">
                <span className="pill">{members.length} members</span>
                {programKind ? (
                  <>
                    <span className="pill">{publishedPrograms.length} published</span>
                    <span className="pill">{draftPrograms.length} awaiting publication</span>
                    <span className="pill">{openTasks.length} open tasks</span>
                    <span className="pill">{events.length} events in {cityName}</span>
                  </>
                ) : (
                  <>
                    <span className="pill">{kindOfWorkspace === 'bia' ? listings.length : claimed.length} listings</span>
                    <span className="pill">{openTasks.length} open tasks</span>
                    <span className="pill">{openRequests.length} open requests</span>
                    <span className="pill">{publishedOffers.length} published offers</span>
                  </>
                )}
              </div>
              <p className="muted">
                {programKind
                  ? `${workspace.name} in ${cityName}: ${publishedPrograms.length} published ${config.programs?.noun ?? 'program'}${publishedPrograms.length === 1 ? '' : 's'}, ${draftPrograms.length} draft${draftPrograms.length === 1 ? '' : 's'} awaiting publication, and a work queue of ${tasks.length} tasks.`
                  : kindOfWorkspace === 'bia'
                    ? `Corridor directory: ${listings.length} of the ${cityListingCount} listings and places in ${cityName} are inside ${area?.properties.name ?? 'this corridor'}, with ${events.length} event${events.length === 1 ? '' : 's'} there and a work queue of ${tasks.length} tasks. Businesses outside the boundary are not listed.`
                    : `Your claimed listings in ${cityName}: ${claimed.length}. Unclaimed businesses in the same city can be claimed from the Listings tab.`}
              </p>
              <section aria-label="Your access" className="card">
                <h3 style={{ marginTop: 0 }}>Your access</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Acting as {personaDef.label}
                  {actor ? ` (${actor.name} — ${config.roleLabels[actor.role]}${actor.status === 'invited' ? ', invitation not accepted' : ''})` : ' (not a member of this workspace)'}
                  : {PERMISSION_ACTIONS.map((a) => `${a.label} ${can(a.id).allowed ? '✓' : '✕'}`).join(' · ')}
                </p>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Your role was set when you signed up. <Link href="/settings">Change it in Settings</Link>.
                </p>
              </section>
              {config.safeguards.map((sg) => (
                <p className="notice" key={sg}>{sg}</p>
              ))}
              {programKind && draftPrograms.length > 0 && (
                <>
                  <h3>Awaiting publication</h3>
                  {draftPrograms.map((p) => (
                    <ProgramCard
                      key={p.id}
                      program={p}
                      publish={can('publish')}
                      onPublish={() => act(() => services.workspaces.publishProgram(p.id, actorContext), 'Published.')}
                    />
                  ))}
                </>
              )}
              {kindOfWorkspace === 'bia' && <SignalLoop tasks={tasks} onAdvance={(id, status) => act(() => services.workspaces.updateTask(workspace.id, id, status, actorContext), 'Task updated.')} canWork={can('work')} />}
              {kindOfWorkspace === 'government' && openRequests.length > 0 && (
                <section aria-label="Requests needing attention" className="card">
                  <h3 style={{ marginTop: 0 }}>Requests needing attention</h3>
                  {openRequests.map((r) => (
                    <p key={r.id} className="muted" style={{ margin: '4px 0' }}>
                      {r.title} — {STATUS_LABEL[r.status]}
                      {r.assignee ? ` · Assigned to ${r.assignee.name}` : ' · Not assigned yet'}
                    </p>
                  ))}
                  <div className="btn-row">
                    <button type="button" className="btn secondary" onClick={() => setTab('requests')}>
                      Open the Requests tab
                    </button>
                  </div>
                </section>
              )}
              <div className="btn-row">
                <Link className="btn secondary" href="/map">Open the map</Link>
                <Link className="btn secondary" href="/businesses">Business directory</Link>
              </div>
            </section>
          )}

          {!viewBlocked && activeTab === 'members' && (
            <section aria-label="Members">
              <h2>{config.tabs.find((t) => t.id === 'members')?.label ?? 'Members'}</h2>
              <p className="muted">
                Who can do what in this workspace: owners manage members, tasks and publishing; staff work on tasks
                and publish; members view. Roles are set when a person signs up; an owner manages who is in this
                workspace here. Names below are demo names, not real people.
              </p>
              {members.map((m) => (
                <article className="card" key={m.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{m.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {config.roleLabels[m.role]} · {m.status === 'active' ? 'Active' : 'Invited, not yet active'}
                  </p>
                  <div className="btn-row" style={{ margin: '8px 0 0' }}>
                    <label>
                      <span className="muted">Role: </span>
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        disabled={!can('manage').allowed}
                        onChange={(e) =>
                          void act(
                            () => services.workspaces.changeMemberRole(m.id, e.target.value as MemberRole, actorContext),
                            'Role changed.',
                          )
                        }
                        style={{ padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}
                      >
                        {ROLE_IDS.map((r) => (
                          <option key={r} value={r}>{config.roleLabels[r]}</option>
                        ))}
                      </select>
                    </label>
                    {m.status === 'invited' && (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => act(() => services.workspaces.acceptInvite(m.id), 'Invitation accepted (demo).')}
                      >
                        Accept invitation as this person (demo)
                      </button>
                    )}
                  </div>
                </article>
              ))}
              <Reason decision={can('manage')} />
              <h3>Invite someone</h3>
              <div style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Demo name (no real people)"
                  aria-label="Name to invite"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <label>
                  <span className="muted">Role: </span>
                  <select
                    aria-label="Role to invite as"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    style={{ padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}
                  >
                    {ROLE_IDS.map((r) => (
                      <option key={r} value={r}>{config.roleLabels[r]}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn"
                  disabled={!can('manage').allowed}
                  onClick={() => {
                    void act(
                      () => services.workspaces.inviteMember({ workspaceId: workspace.id, name: inviteName, role: inviteRole }, actorContext),
                      'Invitation created. The person has no access until they accept.',
                    );
                    setInviteName('');
                  }}
                >
                  Send invitation
                </button>
              </div>
            </section>
          )}

          {!viewBlocked && activeTab === 'programs' && programKind && (
            <section aria-label={config.programs?.heading ?? 'Programs'}>
              <h2>{config.programs?.heading ?? 'Programs'}</h2>
              <p className="muted">{config.programs?.help}</p>
              {programs.map((p) => (
                <ProgramCard
                  key={p.id}
                  program={p}
                  publish={can('publish')}
                  onPublish={() => act(() => services.workspaces.publishProgram(p.id, actorContext), 'Published.')}
                />
              ))}
              {programs.length === 0 && <p className="muted">Nothing here yet. Create a draft below.</p>}
              <h3>Create a draft</h3>
              <div style={{ display: 'grid', gap: 8, maxWidth: '70ch' }}>
                <input
                  value={programTitle}
                  onChange={(e) => setProgramTitle(e.target.value)}
                  placeholder={`Title of the ${config.programs?.noun ?? 'program'}`}
                  aria-label="Program title"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <input
                  value={programSummary}
                  onChange={(e) => setProgramSummary(e.target.value)}
                  placeholder="Short description (optional)"
                  aria-label="Program description"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!can('work').allowed}
                  onClick={() => {
                    void act(
                      () => services.workspaces.createProgram({ workspaceId: workspace.id, title: programTitle, summary: programSummary }, actorContext),
                      'Draft created. It stays inside the workspace until published.',
                    );
                    setProgramTitle('');
                    setProgramSummary('');
                  }}
                >
                  Create draft
                </button>
                <Reason decision={can('work')} />
              </div>
            </section>
          )}

          {!viewBlocked && activeTab === 'listings' && (
            <section aria-label="Listings">
              <h2>{kindOfWorkspace === 'bia' ? 'Corridor listings' : 'Your listings'}</h2>
              {(kindOfWorkspace === 'bia' ? listings : claimed).map((o) => (
                <ListingCard key={o.id} object={o} />
              ))}
              {(kindOfWorkspace === 'bia' ? listings : claimed).length === 0 && (
                <p className="muted">No listings yet. Claim one below.</p>
              )}
              {kindOfWorkspace === 'business' && claimable.length > 0 && (
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
                          disabled={!can('work').allowed}
                          onClick={() => act(() => services.workspaces.claimListing(workspace.id, o.id, actorContext), 'Listing claimed into this workspace.')}
                        >
                          Claim this listing
                        </button>
                        <Link className="btn secondary" href={mapHref(o.id)}>📍 View on map</Link>
                      </div>
                    </article>
                  ))}
                  <Reason decision={can('work')} />
                </>
              )}
            </section>
          )}

          {!viewBlocked && activeTab === 'offers' && (
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
                        disabled={!can('publish').allowed}
                        onClick={() => act(() => services.workspaces.publishOffer(o.id, actorContext), 'Offer published.')}
                      >
                        Publish offer
                      </button>
                    )}
                    <Link className="btn secondary" href={mapHref(o.businessId)}>📍 View business on map</Link>
                  </div>
                  {o.status === 'draft' && <Reason decision={can('publish')} />}
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
                  disabled={!can('work').allowed || (claimed.length === 0 && listings.filter((o) => o.kind === 'business').length === 0)}
                  onClick={() => {
                    const businessId = (claimed[0] ?? listings.find((o) => o.kind === 'business'))?.id;
                    if (!businessId) return;
                    void act(
                      () => services.workspaces.createOffer({ workspaceId: workspace.id, businessId, title: offerTitle, summary: offerSummary }, actorContext),
                      'Draft offer created.',
                    );
                    setOfferTitle('');
                    setOfferSummary('');
                  }}
                >
                  Create draft
                </button>
                <Reason decision={can('work')} />
              </div>
            </section>
          )}

          {!viewBlocked && activeTab === 'events' && (
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

          {!viewBlocked && activeTab === 'requests' && (
            <RequestQueue
              requests={requests}
              workspace={workspace}
              roleLabels={config.roleLabels}
              members={members}
              actor={handlerActor}
              services={services}
              onChanged={load}
            />
          )}

          {!viewBlocked && activeTab === 'tasks' && (
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
                      disabled={!can('work').allowed}
                      onClick={() =>
                        act(
                          () => services.workspaces.updateTask(workspace.id, t.id, t.status === 'open' ? 'in-progress' : 'done', actorContext),
                          'Task updated.',
                        )
                      }
                    >
                      {NEXT_TASK_LABEL[t.status]}
                    </button>
                  )}
                </article>
              ))}
              <Reason decision={can('work')} />
            </section>
          )}
        </WorkspaceShell>
      )}
    </StateBoundary>
  );
}

/** Shows why a control is unavailable, in words (the disabled button alone says nothing). */
function Reason({ decision }: { decision: PermissionDecision }) {
  if (decision.allowed) return null;
  return <p className="muted" role="note">Not available for this person: {decision.reason}</p>;
}

function ProgramCard({
  program,
  publish,
  onPublish,
}: {
  program: WorkspaceProgram;
  publish: PermissionDecision;
  onPublish: () => void;
}) {
  return (
    <article className="card">
      <h3 style={{ margin: '0 0 4px' }}>{program.title}</h3>
      <p className="muted" style={{ margin: '0 0 8px' }}>{program.summary}</p>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        Status: {program.status === 'published' ? 'published (public)' : 'draft (workspace only)'}
      </p>
      <div className="btn-row">
        {program.status === 'draft' && (
          <button type="button" className="btn secondary" disabled={!publish.allowed} onClick={onPublish}>
            Publish
          </button>
        )}
        {program.objectId && <Link className="btn secondary" href={mapHref(program.objectId)}>📍 View on map</Link>}
      </div>
      {program.status === 'draft' && <Reason decision={publish} />}
    </article>
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
function SignalLoop({
  tasks,
  onAdvance,
  canWork,
}: {
  tasks: WorkspaceTask[];
  onAdvance: (id: string, status: TaskStatus) => void;
  canWork: PermissionDecision;
}) {
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
          disabled={!canWork.allowed}
          onClick={() => onAdvance(task.id, task.status === 'open' ? 'in-progress' : 'done')}
        >
          {NEXT_TASK_LABEL[task.status]}
        </button>
      )}
      <Reason decision={canWork} />
    </section>
  );
}
