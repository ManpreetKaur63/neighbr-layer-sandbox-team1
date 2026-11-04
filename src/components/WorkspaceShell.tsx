import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from './SiteHeader';
import type { Workspace, WorkspaceKind } from '@/lib/schemas';
import { workspaceHref } from '@/lib/workspace';

export type WorkspaceTab = 'overview' | 'members' | 'listings' | 'offers' | 'events' | 'tasks';

export const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'listings', label: 'Listings' },
  { id: 'offers', label: 'Offers' },
  { id: 'events', label: 'Events' },
  { id: 'tasks', label: 'Tasks' },
];

/**
 * M05 reusable tenant shell. BIA and Business pages render through this one
 * component: same header, same tenant navigation, same access-state banner.
 * Only the workspace record (kind, name, status, city) changes. This is the
 * piece M06/M07 reuse by configuring new kinds from it, instead of copying
 * a page per tenant type.
 */
export function WorkspaceShell({
  workspace,
  siblings,
  activeTab,
  onTabChange,
  children,
}: {
  workspace: Workspace;
  /** Other workspaces of the same kind, for the tenant switcher. */
  siblings: Workspace[];
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  children: ReactNode;
}) {
  const kindLabel = workspace.kind === 'bia' ? 'BIA / corridor' : 'Business';
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p>{kindLabel} workspace</p>
        <h1>{workspace.name}</h1>
        <p className="lede">
          {workspace.summary} Everything here is invented demo data; no real business is listed.
        </p>
        <p>
          <span className={`badge ${workspace.status === 'verified' ? 'ok' : ''}`}>
            {workspace.status === 'verified' ? '✓ Verified' : workspace.status === 'onboarding' ? 'Onboarding — not verified yet' : 'Restricted'}
          </span>{' '}
          <span className="muted">Access state applies to this workspace only.</span>
        </p>
        {workspace.status === 'onboarding' && (
          <p className="notice">
            Onboarding workspaces can set up listings, tasks and draft offers, but offers cannot be published
            until verification. That gate is enforced by the workspace service, not just hidden in the UI.
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
          {WORKSPACE_TABS.map((t) => (
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
