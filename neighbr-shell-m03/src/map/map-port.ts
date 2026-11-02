import type { BoundaryCollection, CivicKind, LngLat } from '@/lib/schemas';

export interface MapMarker {
  id: string;
  kind: CivicKind;
  title: string;
  coordinates: LngLat;
}

export interface MapView {
  center: LngLat;
  zoom: number;
}

/** Prefix that tells selection handlers the id refers to a boundary, not a civic object. */
export const BOUNDARY_ID_PREFIX = 'boundary:';

/**
 * The only thing the rest of the app knows about the map. Civic overlays are plain data;
 * nothing outside src/map imports a map provider.
 */
export interface MapPort {
  /** Resolves when the map is ready. Rejects (for example without WebGL) so the UI can fall back to the list. */
  mount(container: HTMLElement, view: MapView): Promise<void>;
  setMarkers(markers: MapMarker[]): void;
  setBoundaries(boundaries: BoundaryCollection): void;
  setBoundariesVisible(visible: boolean): void;
  setSelected(id: string | null): void;
  flyTo(coordinates: LngLat, zoom?: number): void;
  setView(view: MapView): void;
  fitBounds(bounds: [LngLat, LngLat]): void;
  /** Returns an unsubscribe function. Ids with BOUNDARY_ID_PREFIX are boundaries. */
  onSelect(handler: (id: string) => void): () => void;
  destroy(): void;
}

export type MapPortFactory = () => MapPort;
