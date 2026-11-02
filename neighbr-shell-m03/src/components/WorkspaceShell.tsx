import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from './SiteHeader';
import type { Workspace, WorkspaceKind, WorkspaceMember } from '@/lib/schemas';
import { workspaceHref } from '@/lib/workspace';
import { KIND_CONFIG, type WorkspaceTab } from '@/lib/workspace-config';

export type { WorkspaceTab } from '@/lib/workspace-config';

/**
 * Reusable tenant shell (M05), configured per kind in M06. BIA, Business,
 * Institution, School and Community organization pages all render through this
 * one component: same header, same tenant navigation pattern, same access-state
 * banner, same "view as" role switch. Only the workspace record and its entry in
 * `KIND_CONFIG` (tabs, role names, wording) change. Never copy this per tenant.
 */
export function WorkspaceShell({
  workspace,
  siblings,
  members,
  actorId,
  onActorChange,
  activeTab,
  onTabChange,
  children,
}: {
  workspace: Workspace;
  /** Other workspaces served by the same route, for the tenant switcher. */
  siblings: Workspace[];
  /** Members of this workspace: the "view as" choices. */
  members: WorkspaceMember[];
  /** Id of the member the page is currently shown as. */
  actorId: string | null;
  onActorChange: (memberId: string) => void;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  children: ReactNode;
}) {
  const config = KIND_CONFIG[workspace.kind];
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>{config.label} workspace</p>
        <h1>{workspace.name}</h1>
        <p className="lede">
          {workspace.summary} Everything here is invented demo data; no real organization or person is listed.
        </p>
        <p>
          <span className={`badge ${workspace.status === 'verified' ? 'ok' : ''}`}>
            {workspace.status === 'verified' ? '✓ Verified' : workspace.status === 'onboarding' ? 'Onboarding — not verified yet' : 'Restricted — read-only'}
          </span>{' '}
          <span className="muted">Access state applies to this workspace only.</span>
        </p>
        {workspace.status === 'onboarding' && (
          <p className="notice">
            Onboarding workspaces can set up tasks and drafts, but nothing can be published
            until verification. That gate is enforced by the workspace service, not just hidden in the UI.
          </p>
        )}
        {workspace.status === 'restricted' && (
          <p className="notice">
            This workspace is restricted. Everyone can look, but nobody can change anything until the restriction
            is lifted. The workspace service rejects changes, whatever role is selected.
          </p>
        )}
        {siblings.length > 1 && (
          <p className="muted">
            Switch tenant:{' '}
            {siblings.map((s) => (
              <span key={s.id}>
                {s.id === workspace.id ? (
                  <strong>{s.name}</strong>
                ) : (
                  <Link href={workspaceHref(s.kind as WorkspaceKind, s.id)}>{s.name}</Link>
                )}{' '}
              </span>
            ))}
          </p>
        )}
        {members.length > 0 && (
          <p>
            <label>
              <span className="muted">View as (demo role switch): </span>
              <select
                aria-label="View as"
                value={actorId ?? ''}
                onChange={(e) => onActorChange(e.target.value)}
                style={{ padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {config.roleLabels[m.role]}
                    {m.status === 'invited' ? ' (invited, not active)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </p>
        )}
        <nav aria-label="Workspace" className="pill-row" style={{ margin: '1rem 0' }}>
          {config.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pill ${activeTab === t.id ? 'active' : ''}`}
              aria-current={activeTab === t.id ? 'page' : undefined}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {children}
      </main>
    </>
  );
}
