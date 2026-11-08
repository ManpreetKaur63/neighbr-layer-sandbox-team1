import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '@/lib/geo';
import { REPORT_PLACES } from '@/lib/report-places';
import { FIXTURES, createMockServices } from '@/services/mock';
import { createRequestStore } from '@/services/mock/requests';

const corridor = FIXTURES.boundaries.features.find((f) => f.properties.id === 'olde-riverside-corridor')!;
const inside = (c: [number, number]) => pointInPolygon(c, corridor.geometry.coordinates);

describe('geometry helper (M06 review)', () => {
  it('tells inside from outside, edges count as inside, holes are excluded', () => {
    const square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([11, 5], square)).toBe(false);
    expect(pointInPolygon([0, 5], square)).toBe(true);
    const holed = [...square, [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]];
    expect(pointInPolygon([5, 5], holed)).toBe(false);
    expect(pointInPolygon([2, 2], holed)).toBe(true);
  });
});

describe('BIA directory stays inside its boundary (M06 review)', () => {
  it('the BIA workspace names its boundary, and that boundary exists', async () => {
    const s = createMockServices({ requestStore: createRequestStore() });
    const bia = (await s.workspaces.workspaces()).find((w) => w.kind === 'bia')!;
    expect(bia.boundaryId).toBe('olde-riverside-corridor');
    expect(corridor).toBeDefined();
  });

  it('the corridor holds some city listings but not all of them', async () => {
    const s = createMockServices({ requestStore: createRequestStore() });
    const all = (await s.objects.list({ cityId: 'windsor' })).filter((o) => o.kind === 'business' || o.kind === 'place');
    const within = all.filter((o) => inside(o.geo.coordinates));
    expect(within.length).toBeGreaterThan(0);
    expect(within.length).toBeLessThan(all.length);
    // Named examples from the fixtures: the bakery is on the corridor, the downtown pizzeria is not.
    expect(within.map((o) => o.id)).toContain('w-bakery');
    expect(within.map((o) => o.id)).not.toContain('w-pizza');
    expect(within.map((o) => o.id)).not.toContain('w-books');
  });
});

describe('reported issues are routed by place (M06 review)', () => {
  it('the sample places match what the form tells the person', () => {
    expect(inside(REPORT_PLACES[0]!.coordinates)).toBe(true);
    expect(inside(REPORT_PLACES[1]!.coordinates)).toBe(false);
  });

  it('an issue inside the corridor goes to the BIA queue', async () => {
    const s = createMockServices({ requestStore: createRequestStore() });
    const issue = await s.social.reportIssue({ title: 'Bench', summary: '', cityId: 'windsor', coordinates: REPORT_PLACES[0]!.coordinates });
    const r = await s.requests.create({ kind: 'issue', title: issue.title, summary: '', cityId: 'windsor', objectId: issue.id });
    expect(r.workspaceId).toBe('ws-bia-sample');
  });

  it('an issue outside every BIA is refused routing but stays on the map for other pages', async () => {
    const store = createRequestStore();
    const s = createMockServices({ requestStore: store });
    const issue = await s.social.reportIssue({ title: 'Dark street', summary: '', cityId: 'windsor', coordinates: REPORT_PLACES[1]!.coordinates });
    await expect(
      s.requests.create({ kind: 'issue', title: issue.title, summary: '', cityId: 'windsor', objectId: issue.id }),
    ).rejects.toThrow(/No BIA covers this location/);
    expect(store.requests).toHaveLength(0);
    // Another page (a new service instance on the same store) still sees the issue.
    const other = createMockServices({ requestStore: store });
    expect(await other.objects.get(issue.id)).not.toBeNull();
  });
});

describe('changes carry across screens (M06 review)', () => {
  it('a report, an assignment and a resolution are all visible from fresh service instances on the same store', async () => {
    const store = createRequestStore();
    const report = createMockServices({ requestStore: store });
    const issue = await report.social.reportIssue({ title: 'Broken bench', summary: 'Loose slats', cityId: 'windsor', coordinates: REPORT_PLACES[0]!.coordinates });
    const sent = await report.requests.create({ kind: 'issue', title: issue.title, summary: issue.summary, cityId: 'windsor', objectId: issue.id });

    const bia = createMockServices({ requestStore: store }); // the BIA page builds its own services
    expect((await bia.requests.list({ workspaceId: 'ws-bia-sample' })).map((r) => r.id)).toContain(sent.id);
    const chair = { name: 'Demo BIA chair', role: 'owner' as const, memberStatus: 'active' as const };
    await bia.requests.handle(sent.id, { action: 'start-review' }, chair);
    await bia.requests.handle(sent.id, { action: 'resolve', note: 'Bench repaired' }, chair);

    const map = createMockServices({ requestStore: store }); // then the map page
    expect((await map.objects.get(issue.id))?.status).toBe('Resolved');
    const inbox = createMockServices({ requestStore: store }); // and the resident's inbox
    expect((await inbox.requests.get(sent.id))?.status).toBe('resolved');
    expect((await inbox.social.notifications()).some((n) => n.title.startsWith('Resolved'))).toBe(true);
  });
});
