import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/services/mock';
import { civicObjectSchema } from '@/lib/schemas';

describe('synthetic fixtures', () => {
  it('validate against the shared contracts (module load would throw otherwise)', () => {
    expect(FIXTURES.objects.length).toBeGreaterThan(20);
    expect(FIXTURES.cities.map((c) => c.id)).toContain('windsor');
  });

  it('have unique ids and only reference known cities', () => {
    const ids = FIXTURES.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cityIds = new Set(FIXTURES.cities.map((c) => c.id));
    FIXTURES.objects.forEach((o) => expect(cityIds.has(o.cityId), o.id).toBe(true));
    FIXTURES.boundaries.features.forEach((f) => expect(cityIds.has(f.properties.cityId), f.id as string).toBe(true));
  });

  it('are all marked synthetic and every boundary is illustrative', () => {
    FIXTURES.objects.forEach((o) => expect(o.synthetic).toBe(true));
    FIXTURES.boundaries.features.forEach((f) => expect(f.properties.authority).toBe('illustrative'));
  });

  it('close every boundary ring', () => {
    FIXTURES.boundaries.features.forEach((f) => {
      const ring = f.geometry.coordinates[0]!;
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    });
  });

  it('reject records that break the contract', () => {
    const bad = { ...FIXTURES.objects[0], kind: 'dragon' };
    expect(civicObjectSchema.safeParse(bad).success).toBe(false);
    expect(civicObjectSchema.safeParse({ ...FIXTURES.objects[0], synthetic: false }).success).toBe(false);
  });
});
