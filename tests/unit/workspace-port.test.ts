import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { mapHref, workspaceHref, workspaceHrefForObject } from '@/lib/workspace';

describe('workspace port (M05)', () => {
  it('lists one BIA and two business workspaces, with access states', async () => {
    const s = createMockServices();
    const all = await s.workspaces.workspaces();
    expect(all.filter((w) => w.kind === 'bia')).toHaveLength(1);
    expect(all.filter((w) => w.kind === 'business')).toHaveLength(2);
    expect(all.find((w) => w.id === 'ws-bia-sample')?.status).toBe('verified');
    expect(all.find((w) => w.id === 'ws-biz-hardware')?.status).toBe('onboarding');
  });

  it('returns null for an unknown workspace, and rejects members/tasks for one', async () => {
    const s = createMockServices();
    expect(await s.workspaces.workspace('nope')).toBeNull();
    await expect(s.workspaces.members('nope')).rejects.toThrow(/not found/);
    await expect(s.workspaces.tasks('nope')).rejects.toThrow(/not found/);
  });

  it('lists members per workspace, not across workspaces', async () => {
    const s = createMockServices();
    const bia = await s.workspaces.members('ws-bia-sample');
    expect(bia).toHaveLength(3);
    expect(bia.every((m) => m.workspaceId === 'ws-bia-sample')).toBe(true);
    expect(bia.some((m) => m.role === 'owner' && m.status === 'active')).toBe(true);
  });

  it('moves tasks only one step forward and never back from done', async () => {
    const s = createMockServices();
    const task = (await s.workspaces.tasks('ws-bia-sample')).find((t) => t.id === 't-bia-vacancy')!;
    expect(task.status).toBe('open');
    await expect(s.workspaces.updateTask('ws-bia-sample', task.id, 'done')).rejects.toThrow(/only move/);
    const started = await s.workspaces.updateTask('ws-bia-sample', task.id, 'in-progress');
    expect(started.status).toBe('in-progress');
    const done = await s.workspaces.updateTask('ws-bia-sample', task.id, 'done');
    expect(done.status).toBe('done');
    await expect(s.workspaces.updateTask('ws-bia-sample', task.id, 'in-progress')).rejects.toThrow(/cannot move back/);
    await expect(s.workspaces.updateTask('ws-bia-sample', 'nope', 'done')).rejects.toThrow(/not found/);
  });

  it('traces the BIA signal loop: the works task can be completed', async () => {
    const s = createMockServices();
    const before = (await s.workspaces.tasks('ws-bia-sample')).find((t) => t.id === 't-bia-works')!;
    expect(before.status).toBe('in-progress');
    const done = await s.workspaces.updateTask('ws-bia-sample', 't-bia-works', 'done');
    expect(done.status).toBe('done');
    expect(await s.objects.get('w-roadworks')).not.toBeNull();
  });

  it('creates drafts, publishes only from a verified workspace, and validates', async () => {
    const s = createMockServices();
    await expect(
      s.workspaces.createOffer({ workspaceId: 'ws-biz-bakery', businessId: 'w-bakery', title: '  ', summary: '' }),
    ).rejects.toThrow(/title/);
    await expect(
      s.workspaces.createOffer({ workspaceId: 'nope', businessId: 'w-bakery', title: 'X', summary: '' }),
    ).rejects.toThrow(/not found/);
    await expect(
      s.workspaces.createOffer({ workspaceId: 'ws-biz-bakery', businessId: 'w-market', title: 'X', summary: '' }),
    ).rejects.toThrow(/business listing/);
    const draft = await s.workspaces.createOffer({
      workspaceId: 'ws-biz-bakery', businessId: 'w-bakery', title: 'Test bundle', summary: 'Demo',
    });
    expect(draft.status).toBe('draft');
    expect((await s.workspaces.publishOffer(draft.id)).status).toBe('published');
    await expect(s.workspaces.publishOffer(draft.id)).rejects.toThrow(/draft/);

    // Onboarding workspace: draft is fine, publish is gated on verification.
    const hwDraft = await s.workspaces.createOffer({
      workspaceId: 'ws-biz-hardware', businessId: 'w-hardware', title: 'HW test', summary: '',
    });
    await expect(s.workspaces.publishOffer(hwDraft.id)).rejects.toThrow(/verified/);
  });

  it('claims an unclaimed business once, and only into one workspace', async () => {
    const s = createMockServices();
    const cafe = await s.objects.get('w-cafe');
    expect(cafe?.workspaceId).toBeUndefined();
    const claimed = await s.workspaces.claimListing('ws-biz-bakery', 'w-cafe');
    expect(claimed.workspaceId).toBe('ws-biz-bakery');
    await expect(s.workspaces.claimListing('ws-biz-hardware', 'w-cafe')).rejects.toThrow(/already claimed/);
    await expect(s.workspaces.claimListing('ws-biz-bakery', 'w-market')).rejects.toThrow(/business listing/);
    await expect(s.workspaces.claimListing('ws-biz-bakery', 'nope')).rejects.toThrow(/not found/);
  });

  it('keeps claims, tasks and offers isolated between factory instances', async () => {
    const a = createMockServices();
    const b = createMockServices();
    await a.workspaces.claimListing('ws-biz-bakery', 'w-cafe');
    await a.workspaces.updateTask('ws-bia-sample', 't-bia-vacancy', 'in-progress');
    expect((await b.objects.get('w-cafe'))?.workspaceId).toBeUndefined();
    expect((await b.workspaces.tasks('ws-bia-sample')).find((t) => t.id === 't-bia-vacancy')?.status).toBe('open');
  });
});

describe('workspace <-> map cross-journeys (M05)', () => {
  it('builds workspace and map deep links from one helper', () => {
    expect(workspaceHref('bia', 'ws-bia-sample')).toBe('/bia?ws=ws-bia-sample');
    expect(workspaceHref('business', 'ws-biz-bakery')).toBe('/business?ws=ws-biz-bakery');
    expect(mapHref('w-bakery')).toBe('/map?sel=w-bakery');
  });

  it('links owned records to their workspace, and nothing else', () => {
    expect(workspaceHrefForObject({ kind: 'business', workspaceId: 'ws-biz-bakery' })).toBe(
      '/business?ws=ws-biz-bakery',
    );
    expect(workspaceHrefForObject({ kind: 'organization', workspaceId: 'ws-bia-sample' })).toBe(
      '/bia?ws=ws-bia-sample',
    );
    expect(workspaceHrefForObject({ kind: 'business' })).toBeNull();
    expect(workspaceHrefForObject({ kind: 'event' })).toBeNull();
  });

  it('every claimed fixture object resolves on the map', async () => {
    const s = createMockServices();
    for (const id of ['w-bakery', 'w-hardware', 'w-bia']) {
      const object = await s.objects.get(id);
      expect(object).not.toBeNull();
      expect(workspaceHrefForObject(object!)).not.toBeNull();
    }
  });
});
