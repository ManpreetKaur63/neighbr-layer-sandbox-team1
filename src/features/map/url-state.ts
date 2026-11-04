import { civicKindSchema, lensSchema, type CivicKind, type Lens } from '@/lib/schemas';

export type DemoMode = 'loading' | 'error' | 'empty' | null;

export interface MapUrlState {
  city: string;
  lens: Lens;
  kinds: CivicKind[];
  q: string;
  /** Selected civic object id, or "boundary:<id>". */
  sel: string | null;
  /** Whether illustrative boundaries are drawn. */
  areas: boolean;
  demo: DemoMode;
}

export const DEFAULT_URL_STATE: MapUrlState = {
  city: 'windsor',
  lens: 'combined',
  kinds: [],
  q: '',
  sel: null,
  areas: true,
  demo: null,
};

/** Deep links are part of the contract, so every piece of map state lives in the query string. */
export function parseUrlState(search: string): MapUrlState {
  const p = new URLSearchParams(search);
  const lens = lensSchema.safeParse(p.get('lens'));
  const kinds = (p.get('kinds') ?? '')
    .split(',')
    .map((k) => civicKindSchema.safeParse(k))
    .flatMap((r) => (r.success ? [r.data] : []));
  const demo = p.get('demo');
  return {
    city: p.get('city') || DEFAULT_URL_STATE.city,
    lens: lens.success ? lens.data : DEFAULT_URL_STATE.lens,
    kinds: Array.from(new Set(kinds)),
    q: p.get('q') ?? '',
    sel: p.get('sel') || null,
    areas: p.get('areas') !== '0',
    demo: demo === 'loading' || demo === 'error' || demo === 'empty' ? demo : null,
  };
}

export function toSearchString(state: MapUrlState): string {
  const p = new URLSearchParams();
  if (state.city !== DEFAULT_URL_STATE.city) p.set('city', state.city);
  if (state.lens !== DEFAULT_URL_STATE.lens) p.set('lens', state.lens);
  if (state.kinds.length > 0) p.set('kinds', state.kinds.join(','));
  if (state.q) p.set('q', state.q);
  if (state.sel) p.set('sel', state.sel);
  if (!state.areas) p.set('areas', '0');
  if (state.demo) p.set('demo', state.demo);
  const s = p.toString();
  return s ? `?${s}` : '';
}
