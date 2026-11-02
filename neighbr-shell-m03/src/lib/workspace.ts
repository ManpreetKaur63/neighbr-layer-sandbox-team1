import type { WorkspaceKind } from './schemas';
import { routeForKind } from './workspace-config';

/**
 * M05 cross-journey helpers. These are the only places that know which
 * route serves which workspace kind, so the map detail panel, the directory
 * and the workspace pages can never drift apart.
 */

/**
 * Workspace deep link, e.g. `/business?ws=ws-biz-bakery`. M06: the route comes
 * from the per-kind configuration, so institutions and schools share
 * `/institution` and community organizations use `/organization`.
 */
export function workspaceHref(kind: WorkspaceKind, workspaceId: string): string {
  return `${routeForKind(kind)}?ws=${workspaceId}`;
}

/** Map deep link that selects one civic object, e.g. `/map?sel=w-bakery`. */
export function mapHref(objectId: string): string {
  return `/map?sel=${objectId}`;
}

/**
 * Which workspace route (if any) owns a civic object. Business objects link
 * to the Business workspace; the BIA organisation object links to the BIA
 * workspace. Everything else has no workspace and returns null.
 */
export function workspaceHrefForObject(object: {
  kind: string;
  workspaceId?: string;
}): string | null {
  if (!object.workspaceId) return null;
  if (object.kind === 'organization') return workspaceHref('bia', object.workspaceId);
  if (object.kind === 'business') return workspaceHref('business', object.workspaceId);
  return null;
}
