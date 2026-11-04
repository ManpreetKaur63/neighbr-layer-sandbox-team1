import { describe, expect, it } from 'vitest';
import { pointInRing } from '@/lib/geo';
import { FIXTURES } from '@/services/mock';
import type { LngLat } from '@/lib/schemas';

const square: LngLat[] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

describe('pointInRing', () => {
  it('is true inside and false outside a ring', () => {
    expect(pointInRing([5, 5], square)).toBe(true);
    expect(pointInRing([11, 5], square)).toBe(false);
    expect(pointInRing([5, -1], square)).toBe(false);
  });

  it('handles the thin Olde Riverside corridor outline', () => {
    const ring = FIXTURES.boundaries.features.find((f) => f.properties.id === 'olde-riverside-corridor')!
      .geometry.coordinates[0] as LngLat[];
    const byId = (id: string) => FIXTURES.objects.find((o) => o.id === id)!.geo.coordinates;
    expect(pointInRing(byId('w-bakery'), ring)).toBe(true);
    expect(pointInRing(byId('w-cafe'), ring)).toBe(true);
    expect(pointInRing(byId('w-books'), ring)).toBe(false);
    expect(pointInRing(byId('w-pizza'), ring)).toBe(false);
  });
});
