'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StateBoundary } from './StateBoundary';
import { RolesPanel } from './RolesPanel';
import { WorkspaceShell } from './WorkspaceShell';
import { createMockServices } from '@/services/mock';
import { mapHref, workspaceHrefForObject } from '@/lib/workspace';
import { KIND_CONFIG, usesPrograms, type WorkspaceTab } from '@/lib/workspace-config';
import { PERMISSION_ACTIONS, decide, type ActorContext, type PermissionAction, type PermissionDecision } from '@/lib/permissions';
import type {
  CivicObject,
  MemberRole,
  TaskStatus,
  Workspace,
  WorkspaceKind,
  WorkspaceMember,
  WorkspaceOffer,
  WorkspaceProgram,
  WorkspaceTask,
} from '@/lib/schemas';

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'open',
  'in-progress': 'in progress',
  done: 'done',
  declined: 'declined',
  'needs-info': 'needs more information',
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
  const [objects, setObjects] = useState<CivicObject[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
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
      const [m, t, o, pr, cities, objs] = await Promise.all([
        services.workspaces.members(chosen.id),
        services.workspaces.tasks(chosen.id),
        services.workspaces.offers(chosen.id),
        services.workspaces.programs(chosen.id),
        services.cities.list(),
        services.objects.list({ cityId: chosen.cityId }),
      ]);
      setWorkspace(chosen);
      setSiblings(ofKind);
      setMembers(m);
      setTasks(t);
      setOffers(o);
      setPrograms(pr);
      // Default the "view as" person to the first active owner; keep the choice while it still exists.
      setActorId((prev) =>
        prev && m.some((x) => x.id === prev)
          ? prev
          : (m.find((x) => x.role === 'owner' && x.status === 'active') ?? m[0])?.id ?? null,
      );
      setCityName(cities.find((c) => c.id === chosen.cityId)?.name ?? chosen.cityId);
      setObjects(objs);
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
  const listings = objects.filter((o) => o.kind === 'business' || o.kind === 'place');
  const claimed = workspace ? listings.filter((o) => o.workspaceId === workspace.id) : [];
  const claimable = workspace
    ? objects.filter((o) => o.kind === 'business' && !o.workspaceId)
    : [];
  const events = objects.filter((o) => o.kind === 'event');
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const publishedOffers = offers.filter((o) => o.status === 'published');
  const publishedPrograms = programs.filter((p) => p.status === 'published');
  const draftPrograms = programs.filter((p) => p.status === 'draft');

  // Who the page is shown as. With no members at all, fall back to least privilege.
  const actor = members.find((m) => m.id === actorId) ?? null;
  const actorContext: ActorContext = actor
    ? { role: actor.role, memberStatus: actor.status }
    : { role: 'member', memberStatus: 'active' };
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
  const viewBlocked = !can('view').allowed && activeTab !== 'roles';

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
          members={members}
          actorId={actorId}
          onActorChange={(id) => {
            setNotice(null);
            setError(null);
            setActorId(id);
          }}
          activeTab={activeTab}
          onTabChange={setTab}
        >
          {notice && <p className="notice" role="status">{notice}</p>}
          {error && <p role="alert" className="muted">{error}</p>}

          {viewBlocked && (
            <StateBoundary
              state="restricted"
              restrictedTitle="No access yet"
              restrictedHelp={`${can('view').reason} Open the Roles & access tab to see why, or switch to another person above.`}
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
                    <span className="pill">{publishedOffers.length} published offers</span>
                  </>
                )}
              </div>
              <p className="muted">
                {programKind
                  ? `${workspace.name} in ${cityName}: ${publishedPrograms.length} published ${config.programs?.noun ?? 'program'}${publishedPrograms.length === 1 ? '' : 's'}, ${draftPrograms.length} draft${draftPrograms.length === 1 ? '' : 's'} awaiting publication, and a work queue of ${tasks.length} tasks.`
                  : kindOfWorkspace === 'bia'
                    ? `Corridor directory for ${cityName}: ${listings.length} listings and places, ${events.length} events, and a work queue of ${tasks.length} tasks.`
                    : `Your claimed listings in ${cityName}: ${claimed.length}. Unclaimed businesses in the same city can be claimed from the Listings tab.`}
              </p>
              <section aria-label="Your access" className="card">
                <h3 style={{ marginTop: 0 }}>Your access</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {actor ? `${actor.name} (${config.roleLabels[actor.role]}${actor.status === 'invited' ? ', invitation not accepted' : ''}): ` : ''}
                  {PERMISSION_ACTIONS.map((a) => `${a.label} ${can(a.id).allowed ? '✓' : '✕'}`).join(' · ')}
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
                and publish; members view. The workspace service applies these rules (see Roles &amp; access).
                Names below are demo names, not real people.
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

          {!viewBlocked && activeTab === 'tasks' && (
            <section aria-label="Tasks">
              <h2>Work queue</h2>
              <p className="muted">
                Tasks move one step forward only: open → in progress → done. A request can also be
                declined (with a recorded reason, and it stays closed) or sent back for more
                information (it returns to open once the information is provided).
              </p>
              {tasks.map((t) => (
                <article className="card" key={t.id}>
                  <h3 style={{ margin: '0 0 4px' }}>{t.title}</h3>
                  <p className="muted" style={{ margin: '0 0 8px' }}>{t.kind} · {TASK_STATUS_LABEL[t.status]}</p>
                  {t.note && <p className="muted" style={{ margin: '0 0 8px' }}>Record: {t.note}</p>}
                  {(t.status === 'open' || t.status === 'in-progress') && (
                    <div className="btn-row">
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
                        {t.status === 'open' ? 'Start task' : 'Mark done'}
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={!can('work').allowed}
                        onClick={() => {
                          const reason = window.prompt(
                            'Why is this request declined? The reason is recorded and shown to the requester.',
                            '',
                          );
                          if (reason === null) return;
                          act(
                            () => services.workspaces.declineTask(workspace.id, t.id, reason, actorContext),
                            'Request declined.',
                          );
                        }}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={!can('work').allowed}
                        onClick={() => {
                          const note = window.prompt(
                            'What information is needed? The requester will see this note.',
                            '',
                          );
                          if (note === null) return;
                          act(
                            () => services.workspaces.requestTaskInfo(workspace.id, t.id, note, actorContext),
                            'Sent back for more information.',
                          );
                        }}
                      >
                        Request info
                      </button>
                    </div>
                  )}
                  {t.status === 'needs-info' && (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={!can('work').allowed}
                      onClick={() => {
                        const note = window.prompt('What information are you providing?', '');
                        if (note === null) return;
                        act(
                          () => services.workspaces.provideTaskInfo(workspace.id, t.id, note, actorContext),
                          'Information provided — the request is open again.',
                        );
                      }}
                    >
                      Provide info
                    </button>
                  )}
                  {t.status === 'declined' && (
                    <p className="muted" style={{ margin: 0 }}>Declined requests stay closed.</p>
                  )}
                </article>
              ))}
              <Reason decision={can('work')} />
            </section>
          )}

          {activeTab === 'roles' && (
            <RolesPanel workspace={workspace} actor={actor} actorContext={actorContext} />
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
      {(task.status === 'open' || task.status === 'in-progress') && (
        <button
          type="button"
          className="btn secondary"
          disabled={!canWork.allowed}
          onClick={() => onAdvance(task.id, task.status === 'open' ? 'in-progress' : 'done')}
        >
          {task.status === 'open' ? 'Start task' : 'Mark done'}
        </button>
      )}
      <Reason decision={canWork} />
    </section>
  );
}
