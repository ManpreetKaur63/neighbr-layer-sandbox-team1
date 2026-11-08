/**
 * Small geometry helpers. The BIA directory and request routing use these to
 * decide whether a point lies inside a workspace's boundary, so "the corridor"
 * means the same thing on every screen.
 */
export type LngLat = [number, number];

/** Ray casting on one polygon ring ([lng, lat] pairs). Points exactly on an edge count as inside. */
export function pointInRing(point: LngLat, ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    const cross = (y - yi) * (xj - xi) - (x - xi) * (yj - yi);
    const withinX = x >= Math.min(xi, xj) && x <= Math.max(xi, xj);
    const withinY = y >= Math.min(yi, yj) && y <= Math.max(yi, yj);
    if (cross === 0 && withinX && withinY) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point is inside the polygon's outer ring and not inside any hole. */
export function pointInPolygon(point: LngLat, polygon: number[][][]): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((h) => pointInRing(point, h));
}
