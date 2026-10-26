import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/services/mock';
import { filterObjects } from '@/lib/query';
import { kindsForLens } from '@/lib/kinds';

const all = FIXTURES.objects;

describe('filterObjects', () => {
  it('returns only the requested city', () => {
    const r = filterObjects(all, { cityId: 'toronto' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((o) => o.cityId === 'toronto')).toBe(true);
  });

  it('returns nothing for a city with no data (the empty state)', () => {
    expect(filterObjects(all, { cityId: 'miami' })).toEqual([]);
  });

  it('applies the lens', () => {
    const social = filterObjects(all, { cityId: 'windsor', lens: 'social' });
    const civic = filterObjects(all, { cityId: 'windsor', lens: 'civic' });
    expect(social.every((o) => kindsForLens('social').includes(o.kind))).toBe(true);
    expect(civic.every((o) => kindsForLens('civic').includes(o.kind))).toBe(true);
    expect(social.length + civic.length).toBe(filterObjects(all, { cityId: 'windsor', lens: 'combined' }).length);
  });

  it('applies explicit kinds, but never outside the lens', () => {
    const issues = filterObjects(all, { cityId: 'windsor', kinds: ['issue'] });
    expect(issues.length).toBeGreaterThan(1);
    expect(issues.every((o) => o.kind === 'issue')).toBe(true);
    expect(filterObjects(all, { cityId: 'windsor', lens: 'social', kinds: ['issue'] })).toEqual([]);
  });

  it('searches title, summary, status and tags, with every word required', () => {
    expect(filterObjects(all, { cityId: 'windsor', text: 'roadworks' }).map((o) => o.id)).toContain('w-roadworks');
    expect(filterObjects(all, { cityId: 'windsor', text: 'vacant lease' }).map((o) => o.id)).toEqual(['w-vacant']);
    expect(filterObjects(all, { cityId: 'windsor', text: 'ROADWORKS   parking' }).map((o) => o.id)).toEqual(['w-roadworks']);
    expect(filterObjects(all, { cityId: 'windsor', text: 'zzzzzz' })).toEqual([]);
  });

  it('sorts newest update first, then by title', () => {
    const r = filterObjects(all, { cityId: 'windsor' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1]!.updatedAt >= r[i]!.updatedAt).toBe(true);
    }
  });
});
