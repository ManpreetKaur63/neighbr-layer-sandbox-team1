import type { WorkspaceKind } from './schemas';

/**
 * M05 cross-journey helpers. These are the only places that know which
 * route serves which workspace kind, so the map detail panel, the directory
 * and the workspace pages can never drift apart.
 */

/** Workspace deep link, e.g. `/business?ws=ws-biz-bakery`. */
export function workspaceHref(kind: WorkspaceKind, workspaceId: string): string {
  return kind === 'bia' ? `/bia?ws=${workspaceId}` : `/business?ws=${workspaceId}`;
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
