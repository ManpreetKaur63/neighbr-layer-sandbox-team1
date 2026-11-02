import type { MemberRole, Workspace, WorkspaceMember, WorkspaceStatus } from '@/lib/schemas';
import { PERMISSION_ACTIONS, decide, type ActorContext } from '@/lib/permissions';
import { KIND_CONFIG } from '@/lib/workspace-config';

const ROLES: MemberRole[] = ['owner', 'staff', 'member'];
const STATUSES: WorkspaceStatus[] = ['verified', 'onboarding', 'restricted'];

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  verified: 'Verified',
  onboarding: 'Onboarding',
  restricted: 'Restricted',
};

function Cell({ allowed }: { allowed: boolean }) {
  // Words as well as symbols: the answer never depends on colour.
  return <td>{allowed ? '✓ Yes' : '✕ No'}</td>;
}

/**
 * M06 role and permission-state demonstrations. Three views of the same pure
 * rule (`decide`): what each role can do here, how the workspace's access state
 * changes that, and the reason for every decision for the person the page is
 * currently shown as. The same rule is enforced in the WorkspacePort, so what
 * is shown here is what the service accepts and rejects.
 */
export function RolesPanel({
  workspace,
  actor,
  actorContext,
}: {
  workspace: Workspace;
  actor: WorkspaceMember | null;
  actorContext: ActorContext;
}) {
  const config = KIND_CONFIG[workspace.kind];
  return (
    <section aria-label="Roles and access">
      <h2>Roles and access</h2>
      <p className="muted">
        Role names for this kind of workspace are plain-language labels on three fixed roles. The same rules apply to
        every workspace type. Roles are demonstrated with demo names; this shell has no real sign-in.
      </p>

      <h3>Your access right now</h3>
      <p>
        Viewing as <strong>{actor?.name ?? 'an unknown person'}</strong> ({config.roleLabels[actorContext.role]},{' '}
        {actorContext.memberStatus === 'invited' ? 'invitation not accepted' : 'active'}) in a{' '}
        {STATUS_LABEL[workspace.status].toLowerCase()} workspace.
      </p>
      <ul>
        {PERMISSION_ACTIONS.map((a) => {
          const d = decide(a.id, actorContext, workspace.status);
          return (
            <li key={a.id}>
              <strong>{a.label}:</strong> {d.allowed ? 'allowed' : 'not allowed'}. {d.reason}
            </li>
          );
        })}
      </ul>

      <h3>What each role can do in this workspace</h3>
      <table className="matrix">
        <caption className="sr-only">Role permissions in this workspace ({STATUS_LABEL[workspace.status]})</caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            {PERMISSION_ACTIONS.map((a) => (
              <th scope="col" key={a.id}>
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => (
            <tr key={role}>
              <th scope="row">{config.roleLabels[role]}</th>
              {PERMISSION_ACTIONS.map((a) => (
                <Cell key={a.id} allowed={decide(a.id, { role, memberStatus: 'active' }, workspace.status).allowed} />
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">Invited, not yet accepted</th>
            {PERMISSION_ACTIONS.map((a) => (
              <Cell key={a.id} allowed={decide(a.id, { role: 'staff', memberStatus: 'invited' }, workspace.status).allowed} />
            ))}
          </tr>
        </tbody>
      </table>

      <h3>How the workspace access state changes it</h3>
      <p className="muted">
        Shown for the role of the person selected above ({config.roleLabels[actorContext.role]}). Onboarding blocks
        publishing; restricted makes the whole workspace read-only.
      </p>
      <table className="matrix">
        <caption className="sr-only">Effect of workspace access state on the selected role</caption>
        <thead>
          <tr>
            <th scope="col">Access state</th>
            {PERMISSION_ACTIONS.map((a) => (
              <th scope="col" key={a.id}>
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATUSES.map((status) => (
            <tr key={status}>
              <th scope="row">
                {STATUS_LABEL[status]}
                {status === workspace.status ? ' (this workspace)' : ''}
              </th>
              {PERMISSION_ACTIONS.map((a) => (
                <Cell key={a.id} allowed={decide(a.id, actorContext, status).allowed} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>What the actions mean</h3>
      <ul>
        {PERMISSION_ACTIONS.map((a) => (
          <li key={a.id}>
            <strong>{a.label}:</strong> {a.example}.
          </li>
        ))}
      </ul>

      {config.safeguards.length > 0 && (
        <>
          <h3>Safeguards for this kind of workspace</h3>
          <ul>
            {config.safeguards.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      <p className="muted">
        Limit: these rules are enforced by the demo workspace service in memory. There is no authentication, so the
        “view as” switch is a demonstration, not security. A production service must check a real signed-in identity.
      </p>
    </section>
  );
}
