import type { BoundaryCollection, LngLat } from '@/lib/schemas';
import type { MapMarker, MapPort, MapView } from './map-port';

/** In-memory MapPort for tests and for environments without WebGL. Proves the adapter is replaceable. */
export class StubMapPort implements MapPort {
  markers: MapMarker[] = [];
  boundaries: BoundaryCollection = { type: 'FeatureCollection', features: [] };
  boundariesVisible = true;
  selected: string | null = null;
  view: MapView | null = null;
  flights: LngLat[] = [];
  mounted = false;
  private handlers = new Set<(id: string) => void>();

  async mount(_container: HTMLElement, view: MapView) {
    this.mounted = true;
    this.view = view;
  }
  setMarkers(markers: MapMarker[]) {
    this.markers = markers;
  }
  setBoundaries(boundaries: BoundaryCollection) {
    this.boundaries = boundaries;
  }
  setBoundariesVisible(visible: boolean) {
    this.boundariesVisible = visible;
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  flyTo(coordinates: LngLat) {
    this.flights.push(coordinates);
  }
  setView(view: MapView) {
    this.view = view;
  }
  fitBounds(bounds: [LngLat, LngLat]) {
    this.flights.push([(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]);
  }
  onSelect(handler: (id: string) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  /** Test helper: simulate a click on a marker or boundary. */
  emitSelect(id: string) {
    this.handlers.forEach((h) => h(id));
  }
  destroy() {
    this.mounted = false;
    this.handlers.clear();
  }
}
