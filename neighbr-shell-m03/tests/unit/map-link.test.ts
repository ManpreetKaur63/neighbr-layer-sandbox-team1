import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { DEFAULT_URL_STATE, parseUrlState, toSearchString } from '@/features/map/url-state';

/**
 * Cross-map integration (M04): the pulse feed deep-links each object to its
 * pin on the shared map via `/map?sel=<id>`, and the map restores the
 * selection from that URL. These tests pin the contract both sides share.
 */
describe('pulse -> map deep links', () => {
  it('builds a map URL that selects the object', () => {
    const search = toSearchString({ ...DEFAULT_URL_STATE, sel: 'w-hours-poll' });
    expect(search).toBe('?sel=w-hours-poll');
    const state = parseUrlState(search);
    expect(state.sel).toBe('w-hours-poll');
  });

  it('the linked object exists and is retrievable for the detail panel', async () => {
    const s = createMockServices();
    const state = parseUrlState('?sel=w-hours-poll');
    const object = await s.objects.get(state.sel!);
    expect(object).not.toBeNull();
    expect(object!.id).toBe('w-hours-poll');
  });

  it('unknown selections resolve to nothing (the map shows its not-found path)', async () => {
    const s = createMockServices();
    const state = parseUrlState('?sel=does-not-exist');
    expect(await s.objects.get(state.sel!)).toBeNull();
  });

  it('a reported issue immediately deep-links to the map', async () => {
    const s = createMockServices();
    const issue = await s.social.reportIssue({ title: 'Link me', summary: '', cityId: 'windsor' });
    const search = toSearchString({ ...DEFAULT_URL_STATE, sel: issue.id });
    const restored = parseUrlState(search);
    expect(await s.objects.get(restored.sel!)).not.toBeNull();
  });

  it('a created poll immediately deep-links to the map', async () => {
    const s = createMockServices();
    const poll = await s.social.createPoll({ question: 'Link me?', options: ['A', 'B'], cityId: 'windsor' });
    const restored = parseUrlState(toSearchString({ ...DEFAULT_URL_STATE, sel: poll.id }));
    expect((await s.objects.get(restored.sel!))?.kind).toBe('poll');
  });
});
