import type { CivicKind, CivicObject, Lens } from './schemas';
import { kindsForLens } from './kinds';

export interface ObjectQuery {
  cityId: string;
  lens?: Lens;
  /** Explicit kind filter. Empty or missing means "all kinds allowed by the lens". */
  kinds?: CivicKind[];
  text?: string;
}

/** Pure filter shared by the mock adapter and tests. A real service would do this server side. */
export function filterObjects(all: CivicObject[], q: ObjectQuery): CivicObject[] {
  const lensKinds = kindsForLens(q.lens ?? 'combined');
  const kinds = q.kinds && q.kinds.length > 0 ? q.kinds.filter((k) => lensKinds.includes(k)) : lensKinds;
  const needle = q.text?.trim().toLowerCase();
  return all
    .filter((o) => o.cityId === q.cityId)
    .filter((o) => kinds.includes(o.kind))
    .filter((o) => {
      if (!needle) return true;
      const hay = [o.title, o.summary, o.status, o.kind, ...o.tags].join(' ').toLowerCase();
      return needle.split(/\s+/).every((word) => hay.includes(word));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}
