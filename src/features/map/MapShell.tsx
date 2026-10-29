'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  BoundaryCollection,
  City,
  CivicKind,
  CivicObject,
  UserContext,
} from '@/lib/schemas';
import { resolveVisit } from '@/lib/visit';
import type { Services } from '@/services/ports';
import { createMockServices } from '@/services/mock';
import { getSessionServices } from '@/services/session';
import { MapLibreAdapter } from '@/map/maplibre-adapter';
import { BOUNDARY_ID_PREFIX, type MapPort, type MapPortFactory } from '@/map/map-port';
import type { ViewState } from '@/components/StateBoundary';
import { MapCanvas } from './MapCanvas';
import { ContextPill, LensSwitch, TopBar } from './TopBar';
import { useIsPhone } from './use-is-phone';
import { ResultsPanel } from './ResultsPanel';
import { DetailPanel, type BoundaryInfo, type Selection } from './DetailPanel';
import { DestinationDialog } from './DestinationDialog';
import { useUrlState } from './use-url-state';
import styles from './map.module.css';

const defaultFactory: MapPortFactory = () => new MapLibreAdapter();
const FALLBACK_VIEW = { center: [-83.0, 42.32] as [number, number], zoom: 12 };
const EMPTY_BOUNDARIES: BoundaryCollection = { type: 'FeatureCollection', features: [] };

const DOCK_LINKS = [
  { href: '/map', label: 'Map' },
  { href: '/pulse', label: 'Pulse' },
  { href: '/events', label: 'Events' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/messages', label: 'Messages' },
];

function bboxOf(ring: number[][]): [[number, number], [number, number]] {
  const xs = ring.map((c) => c[0] as number);
  const ys = ring.map((c) => c[1] as number);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

interface ShellProps {
  /** Tests and later milestones can inject their own services and map provider. */
  services?: Services;
  mapFactory?: MapPortFactory;
}

export function MapShell({ services: injected, mapFactory = defaultFactory }: ShellProps) {
  const { state, update, ready } = useUrlState();
  // The ?demo= switch only affects the mock adapters, so people can see loading, error and empty states.
  // Normal browsing uses the shared demo session, so reports, claims and BIA actions made on other
  // screens show up here. The demo switches need their own isolated instance so they never poison it.
  const services = useMemo(
    () =>
      injected ??
      (state.demo
        ? createMockServices({
            latencyMs: state.demo === 'loading' ? 4000 : 0,
            failObjects: state.demo === 'error',
            emptyObjects: state.demo === 'empty',
          })
        : getSessionServices()),
    [injected, state.demo],
  );

  const [cities, setCities] = useState<City[]>([]);
  const [user, setUser] = useState<UserContext | null>(null);
  const [boundaries, setBoundaries] = useState<BoundaryCollection>(EMPTY_BOUNDARIES);
  const [result, setResult] = useState<{ key: string; objects: CivicObject[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [fetchedObject, setFetchedObject] = useState<CivicObject | null>(null);
  const [port, setPort] = useState<MapPort | null>(null);
  const [destinationOpen, setDestinationOpen] = useState(false);
  // Phone bottom sheet: 'peek' keeps the map dominant, 'half' shows results, 'full' is for reading.
  // On larger screens the side panel is always open and this state is ignored.
  const isPhone = useIsPhone();
  const [sheet, setSheet] = useState<'peek' | 'half' | 'full'>('peek');
  const bodyOpen = !isPhone || sheet !== 'peek';

  const kindsKey = state.kinds.join(',');
  // A result belongs to one request. Anything else means "still loading", so no state is set synchronously.
  const requestKey = [state.city, state.lens, kindsKey, state.q, retry, state.demo].join('|');
  const current = ready && result?.key === requestKey ? result : null;
  const objects = useMemo(() => current?.objects ?? [], [current]);
  const status: 'loading' | 'success' | 'error' = !current ? 'loading' : current.error !== undefined ? 'error' : 'success';
  const errorMessage = current?.error || undefined;
  const city = cities.find((c) => c.id === state.city) ?? cities[0];
  const visit = city && user ? resolveVisit(user, city, cities) : null;

  // Static reference data.
  useEffect(() => {
    let cancelled = false;
    Promise.all([services.cities.list(), services.session.getContext()]).then(([c, u]) => {
      if (cancelled) return;
      setCities(c);
      setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, [services]);

  useEffect(() => {
    let cancelled = false;
    services.boundaries.listForCity(state.city).then((b) => {
      if (!cancelled) setBoundaries(b);
    });
    return () => {
      cancelled = true;
    };
  }, [services, state.city]);

  // Results.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const key = requestKey;
    services.objects
      .list({ cityId: state.city, lens: state.lens, kinds: state.kinds, text: state.q })
      .then((list) => {
        if (!cancelled) setResult({ key, objects: list });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ key, objects: [], error: err instanceof Error ? err.message : '' });
      });
    return () => {
      cancelled = true;
    };
    // requestKey already encodes every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, ready, requestKey]);

  // The selected civic object may be filtered out of the current list, so fetch it when needed.
  const selectedId = state.sel && !state.sel.startsWith(BOUNDARY_ID_PREFIX) ? state.sel : null;
  const inList = selectedId ? objects.find((o) => o.id === selectedId) : undefined;
  useEffect(() => {
    if (!selectedId || inList) return;
    let cancelled = false;
    services.objects.get(selectedId).then((o) => {
      if (!cancelled) setFetchedObject(o);
    });
    return () => {
      cancelled = true;
    };
  }, [services, selectedId, inList]);
  const selectedObject = inList ?? (fetchedObject && fetchedObject.id === selectedId ? fetchedObject : null);

  const selection: Selection | null = useMemo(() => {
    if (!state.sel) return null;
    if (state.sel.startsWith(BOUNDARY_ID_PREFIX)) {
      const id = state.sel.slice(BOUNDARY_ID_PREFIX.length);
      const feature = boundaries.features.find((f) => f.properties.id === id);
      return feature ? { type: 'boundary', feature } : null;
    }
    return selectedObject ? { type: 'object', object: selectedObject } : null;
  }, [state.sel, boundaries, selectedObject]);

  // Keep the map in step with state. The map only ever receives plain data through MapPort.
  useEffect(() => {
    port?.setMarkers(
      objects.map((o) => ({ id: o.id, kind: o.kind, title: o.title, coordinates: o.geo.coordinates })),
    );
  }, [port, objects]);
  useEffect(() => port?.setBoundaries(boundaries), [port, boundaries]);
  useEffect(() => port?.setBoundariesVisible(state.areas), [port, state.areas]);
  useEffect(() => port?.setSelected(state.sel), [port, state.sel]);
  useEffect(() => {
    if (port && city) port.setView({ center: city.center, zoom: city.zoom });
    // Only re-centre when the city changes, not on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, city?.id]);

  // Businesses inside a selected area, and the BIA that owns it, so the outline is more than a drawing.
  const selectedBoundaryId = state.sel?.startsWith(BOUNDARY_ID_PREFIX) ? state.sel.slice(BOUNDARY_ID_PREFIX.length) : null;
  const [boundaryResult, setBoundaryResult] = useState<{ id: string; info: BoundaryInfo } | null>(null);
  useEffect(() => {
    if (!selectedBoundaryId) return;
    let cancelled = false;
    Promise.all([
      services.objects.list({ cityId: state.city, kinds: ['business'], boundaryId: selectedBoundaryId }),
      services.workspaces.workspaces(),
    ])
      .then(([businesses, all]) => {
        if (cancelled) return;
        const bia = all.find((w) => w.kind === 'bia' && w.boundaryId === selectedBoundaryId);
        setBoundaryResult({ id: selectedBoundaryId, info: { businesses, biaWorkspaceId: bia?.id ?? null } });
      })
      .catch(() => {
        if (!cancelled) setBoundaryResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [services, state.city, selectedBoundaryId]);
  const boundaryInfo = boundaryResult && boundaryResult.id === selectedBoundaryId ? boundaryResult.info : null;

  const select = useCallback(
    (id: string) => {
      update({ sel: id }, { push: true });
      setSheet((v) => (v === 'peek' ? 'half' : v));
      if (id.startsWith(BOUNDARY_ID_PREFIX)) {
        const f = boundaries.features.find((b) => b.properties.id === id.slice(BOUNDARY_ID_PREFIX.length));
        const ring = f?.geometry.coordinates[0];
        if (ring) port?.fitBounds(bboxOf(ring));
      } else {
        const o = objects.find((x) => x.id === id);
        if (o) port?.flyTo(o.geo.coordinates);
      }
    },
    [update, boundaries, objects, port],
  );

  const toggleKind = (kind: CivicKind) => {
    const has = state.kinds.includes(kind);
    update({ kinds: has ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind] });
  };
  const clearFilters = () => {
    update({ kinds: [], q: '' });
  };
  const chooseCity = (c: City) => {
    setDestinationOpen(false);
    update({ city: c.id, kinds: [], q: '', sel: null });
  };

  // One panel at a time. Escape closes the dialog first, then the detail view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (destinationOpen) setDestinationOpen(false);
      else if (state.sel) update({ sel: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [destinationOpen, state.sel, update]);

  const view: ViewState = status === 'success' && objects.length === 0 ? 'empty' : status;
  const hasFilters = state.kinds.length > 0 || state.q.trim().length > 0;
  const panelTitle = selection ? 'Details' : `Nearby in ${city?.name ?? '…'}`;

  return (
    <div className={styles.shell} data-sheet={isPhone ? sheet : 'open'}>
      <a href="#results" className={styles.skip}>
        Skip to results list
      </a>

      <MapCanvas
        factory={mapFactory}
        initialView={FALLBACK_VIEW}
        onReady={setPort}
        onSelect={select}
      />

      <TopBar
        city={city}
        visit={visit}
        lens={state.lens}
        searchText={state.q}
        onSearchText={(q) => update({ q })}
        onLens={(lens) => update({ lens, kinds: [] })}
        onOpenDestination={() => setDestinationOpen(true)}
        compact={isPhone}
      />

      <aside className={styles.panel} aria-label={panelTitle}>
        <div className={styles.panelHead}>
          <h1>{panelTitle}</h1>
          <span className={styles.panelCount} aria-hidden="true">
            {status === 'success' ? `${objects.length}` : ''}
          </span>
          <button
            type="button"
            className={styles.sheetToggle}
            aria-expanded={sheet !== 'peek'}
            onClick={() => setSheet((v) => (v === 'peek' ? 'half' : v === 'half' ? 'full' : 'peek'))}
          >
            {sheet === 'peek' ? 'Show list' : sheet === 'half' ? 'Expand' : 'Hide list'}
          </button>
        </div>
        {isPhone && sheet !== 'peek' && (
          <div className={styles.sheetControls}>
            <LensSwitch lens={state.lens} onLens={(lens) => update({ lens, kinds: [] })} />
            <ContextPill visit={visit} />
          </div>
        )}
        {bodyOpen &&
          (selection ? (
            <DetailPanel selection={selection} visit={visit} city={city} boundaryInfo={boundaryInfo} onBack={() => update({ sel: null })} />
          ) : (
            <ResultsPanel
              city={city}
              lens={state.lens}
              kinds={state.kinds}
              areasVisible={state.areas}
              status={view}
              errorMessage={errorMessage}
              objects={objects}
              areas={boundaries.features}
              hasFilters={hasFilters}
              selectedId={state.sel}
              onToggleKind={toggleKind}
              onToggleAreas={(areas) => update({ areas })}
              onClearFilters={clearFilters}
              onSelect={select}
              onRetry={() => setRetry((n) => n + 1)}
            />
          ))}
        <p className={styles.legend}>
          Everything shown is invented demo data.
        </p>
      </aside>

      <nav className={styles.dock} aria-label="Main">
        {DOCK_LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={l.href === '/map' ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>

      <Link href="/beacon" className={styles.beacon} aria-label="Beacon, your city guide (not built yet)">
        <span aria-hidden="true">B</span>
      </Link>

      {destinationOpen && (
        <DestinationDialog
          cities={cities}
          currentId={city?.id}
          onFind={(t) => services.cities.find(t)}
          onChoose={chooseCity}
          onClose={() => setDestinationOpen(false)}
        />
      )}
    </div>
  );
}
