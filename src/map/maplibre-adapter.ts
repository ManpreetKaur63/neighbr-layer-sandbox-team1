import type { GeoJSONSource, Map as MlMap, StyleSpecification, MapGeoJSONFeature } from 'maplibre-gl';
import type { BoundaryCollection, LngLat } from '@/lib/schemas';
import { KIND_META, KIND_ORDER } from '@/lib/kinds';
import { BOUNDARY_ID_PREFIX, type MapMarker, type MapPort, type MapView } from './map-port';

const EMPTY_POINTS = { type: 'FeatureCollection', features: [] } as const;

function basemapStyle(): StyleSpecification {
  const useTiles = process.env.NEXT_PUBLIC_BASEMAP !== 'none';
  return {
    version: 8,
    sources: useTiles
      ? {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        }
      : {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e6eee4' } },
      ...(useTiles ? [{ id: 'osm', type: 'raster' as const, source: 'osm', paint: { 'raster-saturation': -0.35 } }] : []),
    ],
  };
}

const kindColor: unknown[] = ['match', ['get', 'kind']];
KIND_ORDER.forEach((k) => kindColor.push(k, KIND_META[k].color));
kindColor.push('#5f6f68');

/**
 * MapLibre GL JS implementation of MapPort. This file is the only place that imports the library.
 * Swapping providers means writing another class that implements MapPort.
 */
export class MapLibreAdapter implements MapPort {
  private map: MlMap | null = null;
  private ready = false;
  private markers: MapMarker[] = [];
  private boundaries: BoundaryCollection = { type: 'FeatureCollection', features: [] };
  private boundariesVisible = true;
  private selected: string | null = null;
  private handlers = new Set<(id: string) => void>();
  private pendingView: MapView | null = null;
  private destroyed = false;
  private container: HTMLElement | null = null;

  async mount(container: HTMLElement, view: MapView) {
    this.container = container;
    const maplibregl = await import('maplibre-gl');
    if (this.destroyed) return;
    const lib = (maplibregl as unknown as { default?: typeof maplibregl }).default ?? maplibregl;
    // The worker is served as a static file (see scripts/copy-maplibre-worker.mjs).
    lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

    let map: MlMap;
    try {
      map = new lib.Map({
        container,
        style: basemapStyle(),
        center: view.center,
        zoom: view.zoom,
        attributionControl: { compact: true },
      });
    } catch {
      // Without WebGL the constructor throws. The caller falls back to the results list.
      throw new Error('This browser or device cannot draw the map (WebGL is unavailable).');
    }
    this.map = map;
    map.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');

    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve());
      map.on('error', (e) => {
        // A basemap tile that fails to download must not stop the map: boundaries and pins still draw.
        const isTileProblem = Boolean((e as { tile?: unknown; sourceId?: unknown }).tile || (e as { sourceId?: unknown }).sourceId);
        if (!this.ready && !isTileProblem) reject(e.error ?? new Error('The map failed to load.'));
      });
    });

    if (this.destroyed) {
      map.remove();
      return;
    }
    this.addLayers(map);
    this.ready = true;
    this.flush();
    const start = this.pendingView ?? view;
    map.jumpTo({ center: start.center, zoom: start.zoom, padding: this.padding() });
    this.pendingView = null;
  }

  /** Keep the visible centre clear of the floating panel: beside it on wide screens, above it on phones. */
  private padding() {
    const wide = (this.container?.clientWidth ?? 0) > 760;
    return wide
      ? { top: 90, bottom: 90, left: 420, right: 40 }
      : { top: 180, bottom: Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * 0.46), left: 20, right: 20 };
  }

  private addLayers(map: MlMap) {
    map.addSource('boundaries', { type: 'geojson', data: this.boundaries });
    map.addLayer({
      id: 'boundary-fill',
      type: 'fill',
      source: 'boundaries',
      paint: { 'fill-color': '#1f6f5c', 'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.22, 0.07] },
    });
    map.addLayer({
      id: 'boundary-line',
      type: 'line',
      source: 'boundaries',
      // Dashed because every boundary in this prototype is illustrative, not authoritative.
      paint: { 'line-color': '#0b3d30', 'line-width': 2, 'line-dasharray': [2, 2] },
    });

    map.addSource('markers', {
      type: 'geojson',
      data: EMPTY_POINTS as never,
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 14,
    });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'markers',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0b3d30',
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 10, 25],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#cfe98b',
      },
    });
    map.addLayer({
      id: 'unclustered',
      type: 'circle',
      source: 'markers',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': kindColor as never,
        'circle-radius': 9,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({
      id: 'selected-ring',
      type: 'circle',
      source: 'markers',
      filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 15,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#0b3d30',
      },
    });

    map.on('click', 'unclustered', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) this.emit(id);
    });
    map.on('click', 'clusters', async (e) => {
      const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      if (clusterId === undefined || feature?.geometry.type !== 'Point') return;
      const source = map.getSource('markers') as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: feature.geometry.coordinates as LngLat, zoom: zoom + 0.5 });
    });
    map.on('click', 'boundary-fill', (e) => {
      const onMarker = map.queryRenderedFeatures(e.point, { layers: ['unclustered', 'clusters'] }).length > 0;
      if (onMarker) return;
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) this.emit(BOUNDARY_ID_PREFIX + id);
    });
    for (const layer of ['unclustered', 'clusters', 'boundary-fill']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
  }

  private emit(id: string) {
    this.handlers.forEach((h) => h(id));
  }

  /** Push the latest data into the map. Safe to call before the map is ready. */
  private flush() {
    const map = this.map;
    if (!map || !this.ready) return;
    (map.getSource('markers') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: this.markers.map((m) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: m.coordinates },
        properties: { id: m.id, kind: m.kind, title: m.title },
      })),
    });
    const selectedBoundary = this.selected?.startsWith(BOUNDARY_ID_PREFIX)
      ? this.selected.slice(BOUNDARY_ID_PREFIX.length)
      : null;
    (map.getSource('boundaries') as GeoJSONSource | undefined)?.setData({
      ...this.boundaries,
      features: this.boundaries.features.map((f) => ({
        ...f,
        properties: { ...f.properties, selected: f.properties.id === selectedBoundary ? 1 : 0 },
      })),
    } as never);
    const visibility = this.boundariesVisible ? 'visible' : 'none';
    map.setLayoutProperty('boundary-fill', 'visibility', visibility);
    map.setLayoutProperty('boundary-line', 'visibility', visibility);
    map.setFilter('selected-ring', [
      '==',
      ['get', 'id'],
      this.selected && !selectedBoundary ? this.selected : '__none__',
    ]);
  }

  setMarkers(markers: MapMarker[]) {
    this.markers = markers;
    this.flush();
  }
  setBoundaries(boundaries: BoundaryCollection) {
    this.boundaries = boundaries;
    this.flush();
  }
  setBoundariesVisible(visible: boolean) {
    this.boundariesVisible = visible;
    this.flush();
  }
  setSelected(id: string | null) {
    this.selected = id;
    this.flush();
  }
  flyTo(coordinates: LngLat, zoom?: number) {
    this.map?.flyTo({ center: coordinates, zoom: zoom ?? Math.max(this.map.getZoom(), 15), padding: this.padding(), essential: false });
  }
  setView(view: MapView) {
    if (!this.map || !this.ready) {
      this.pendingView = view;
      return;
    }
    this.map.flyTo({ center: view.center, zoom: view.zoom, padding: this.padding(), essential: false });
  }
  fitBounds(bounds: [LngLat, LngLat]) {
    this.map?.fitBounds(bounds, { padding: this.padding(), maxZoom: 16 });
  }
  onSelect(handler: (id: string) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  destroy() {
    this.destroyed = true;
    this.handlers.clear();
    this.map?.remove();
    this.map = null;
    this.ready = false;
  }
}
