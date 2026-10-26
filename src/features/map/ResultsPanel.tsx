'use client';

import { KIND_META, KIND_ORDER, kindsForLens } from '@/lib/kinds';
import type { BoundaryFeature, City, CivicKind, CivicObject, Lens } from '@/lib/schemas';
import { StateBoundary, type ViewState } from '@/components/StateBoundary';
import { BOUNDARY_ID_PREFIX } from '@/map/map-port';
import styles from './map.module.css';

interface Props {
  city: City | undefined;
  lens: Lens;
  kinds: CivicKind[];
  areasVisible: boolean;
  status: ViewState;
  errorMessage?: string;
  objects: CivicObject[];
  areas: BoundaryFeature[];
  hasFilters: boolean;
  selectedId: string | null;
  onToggleKind: (kind: CivicKind) => void;
  onToggleAreas: (visible: boolean) => void;
  onClearFilters: () => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export function ResultsPanel(p: Props) {
  const available = kindsForLens(p.lens);
  const cityName = p.city?.name ?? 'this city';

  return (
    <div className={styles.panelBody}>
      <div className={styles.filters} role="group" aria-label="Filter by kind">
        {KIND_ORDER.filter((k) => available.includes(k)).map((k) => (
          <button
            key={k}
            type="button"
            className={styles.chip}
            aria-pressed={p.kinds.includes(k)}
            onClick={() => p.onToggleKind(k)}
          >
            <span className={styles.swatch} style={{ background: KIND_META[k].color }} aria-hidden="true" />
            {KIND_META[k].plural}
          </button>
        ))}
        {p.hasFilters && (
          <button type="button" className={styles.linkButton} onClick={p.onClearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <section aria-labelledby="results-heading" className={styles.results} id="results">
        <h2 id="results-heading">Places and activity</h2>
        <p className={styles.count} aria-live="polite">
          {p.status === 'success' || p.status === 'empty' ? `${p.objects.length} ${p.objects.length === 1 ? 'result' : 'results'} in ${cityName}` : ' '}
        </p>
        <StateBoundary
          state={p.status}
          loadingLabel={`Loading ${cityName}…`}
          emptyTitle={p.hasFilters ? 'Nothing matches those filters' : `Nothing on the map in ${cityName} yet`}
          emptyHelp={
            p.hasFilters
              ? 'Try a different search, or clear the filters.'
              : 'This demo only has invented data for Windsor, Detroit and Toronto. Pick one of those to see pins.'
          }
          emptyAction={p.hasFilters ? { label: 'Clear filters', onClick: p.onClearFilters } : undefined}
          errorTitle="The results didn't load"
          errorHelp={p.errorMessage ?? 'Check your connection and try again.'}
          onRetry={p.onRetry}
        >
          <ul>
            {p.objects.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={styles.row}
                  aria-current={p.selectedId === o.id ? 'true' : undefined}
                  onClick={() => p.onSelect(o.id)}
                >
                  <span className={styles.rowTitle}>
                    <span className={styles.swatch} style={{ background: KIND_META[o.kind].color }} aria-hidden="true" />
                    {o.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {KIND_META[o.kind].label} · {o.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </StateBoundary>
      </section>
      {p.areas.length > 0 && (
        <details className={styles.areas}>
          <summary>Areas ({p.areas.length})</summary>
          <label className={styles.toggle}>
            <input type="checkbox" checked={p.areasVisible} onChange={(e) => p.onToggleAreas(e.target.checked)} />
            Show area outlines on the map
          </label>
          <ul>
            {p.areas.map((a) => {
              const id = BOUNDARY_ID_PREFIX + a.properties.id;
              return (
                <li key={a.properties.id}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-current={p.selectedId === id ? 'true' : undefined}
                    onClick={() => p.onSelect(id)}
                  >
                    <span className={styles.rowTitle}>{a.properties.name}</span>
                    <span className={styles.rowMeta}>Illustrative outline, not official</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
