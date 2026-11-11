'use client';

import type { Services } from '@/services/ports';
import type { Workspace } from '@/lib/schemas';
import { CaseStatusTag, Tag } from './GovCommon';
import { useGovData } from './useGovData';
import styles from './gov.module.css';

/**
 * Case tasks: the work queue that routing creates. Nothing is stored twice: each task is read from a case, so
 * the status here is always the case's status. Take the step on the case to change it.
 */
export function CaseTasks({ services, workspace, onOpen }: { services: Services; workspace: Workspace; onOpen: (id: string) => void }) {
  const { cases, loaded, failed } = useGovData(services, workspace);
  if (failed || !loaded) return null;
  // Merged tree: a 'government' workspace both receives cases and works them, so every open case is a task.
  const tasks = cases
    .filter((c) => c.status !== 'closed')
    .map((c) => ({
      c,
      title:
        c.status === 'received' || c.status === 'returned'
          ? `Route ${c.reference}: ${c.title}`
          : c.status === 'routed'
            ? `Accept ${c.reference}: ${c.title}`
            : `Work ${c.reference}: ${c.title}`,
    }));
  return (
    <section aria-label="Case tasks">
      <h3>Case tasks</h3>
      <p className="muted">
        Created by routing. They come from the cases themselves, so they cannot drift from them: take the step on the case to clear one.
      </p>
      {tasks.length === 0 ? (
        <p className="muted">No case tasks. Every case is where it should be.</p>
      ) : (
        <ul className={styles.attention}>
          {tasks.map(({ c, title }) => (
            <li key={c.id} data-urgent={c.priority === 'urgent' ? 'true' : undefined}>
              <div>{title}</div>
              <div className={styles.tags}>
                <CaseStatusTag status={c.status} />
                {c.priority === 'urgent' && <Tag tone="alert">▲ Urgent</Tag>}
              </div>
              <button type="button" className="btn secondary" onClick={() => onOpen(c.id)}>
                Open the case
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
