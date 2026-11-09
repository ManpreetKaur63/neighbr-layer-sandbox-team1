import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from './SiteHeader';
import type { Workspace, WorkspaceKind } from '@/lib/schemas';
import { workspaceHref } from '@/lib/workspace';
import { KIND_CONFIG, type WorkspaceTab } from '@/lib/workspace-config';

export type { WorkspaceTab } from '@/lib/workspace-config';

/**
 * Reusable tenant shell (M05), configured per kind in M06. BIA, Business,
 * Institution, School, Community organization and Government pages all render
 * through this one component: same header, same tenant navigation pattern,
 * same access-state banner, same tabs. Only the workspace record and its entry
 * in `KIND_CONFIG` (tabs, role names, wording) change. Never copy this per
 * tenant. M07: the shell no longer picks who acts — the role comes from
 * onboarding (`src/lib/session.ts`), so there is no "view as" switch here.
 */
export function WorkspaceShell({
  workspace,
  siblings,
  activeTab,
  onTabChange,
  children,
}: {
  workspace: Workspace;
  /** Other workspaces served by the same route, for the tenant switcher. */
  siblings: Workspace[];
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
