import type { LngLat } from './schemas';

/**
 * Ray-casting point-in-polygon test for one GeoJSON ring ([lng, lat] pairs,
 * first point repeated at the end). Pure, so the mock service, the map shell
 * and tests all share one definition of "inside this boundary".
 */
export function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as LngLat;
    const [xj, yj] = ring[j] as LngLat;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
