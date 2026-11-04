import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';

describe('mock services', () => {
  it('lists, gets and filters objects', async () => {
    const s = createMockServices();
    const list = await s.objects.list({ cityId: 'windsor', text: 'bakery' });
    expect(list.map((o) => o.id)).toEqual(['w-bakery']);
    expect((await s.objects.get('w-bakery'))?.title).toBe('Sample Riverside Bakery');
    expect(await s.objects.get('nope')).toBeNull();
  });

  it('returns boundaries for one city only', async () => {
    const s = createMockServices();
    const b = await s.boundaries.listForCity('toronto');
    expect(b.features.map((f) => f.properties.id)).toEqual(['toronto-core']);
  });

  it('finds destinations by name and rejects unknown ones', async () => {
    const s = createMockServices();
    expect((await s.cities.find('toron'))?.id).toBe('toronto');
    expect((await s.cities.find('  '))).toBeNull();
    expect(await s.cities.find('Atlantis')).toBeNull();
  });

  it('can simulate failure and emptiness for the state demos', async () => {
    await expect(createMockServices({ failObjects: true }).objects.list({ cityId: 'windsor' })).rejects.toThrow(/fail/);
    expect(await createMockServices({ emptyObjects: true }).objects.list({ cityId: 'windsor' })).toEqual([]);
  });
});
