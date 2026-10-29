import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';

const CORRIDOR = 'olde-riverside-corridor';
const IN_CORRIDOR: [number, number] = [-82.985, 42.325];
const DOWNTOWN: [number, number] = [-83.037, 42.317];
const BIA = 'ws-bia-sample';

describe('BIA boundary: the directory only shows what is inside it', () => {
  it('lists only the corridor businesses, not every business in the city', async () => {
    const s = createMockServices();
    const city = await s.objects.list({ cityId: 'windsor', kinds: ['business'] });
    const corridor = await s.objects.list({ cityId: 'windsor', kinds: ['business'], boundaryId: CORRIDOR });
    expect(city.map((o) => o.id).sort()).toEqual(['w-bakery', 'w-books', 'w-cafe', 'w-hardware', 'w-pizza']);
    expect(corridor.map((o) => o.id).sort()).toEqual(['w-bakery', 'w-cafe', 'w-hardware']);
  });

  it('rejects an unknown boundary instead of silently showing everything', async () => {
    const s = createMockServices();
    await expect(s.objects.list({ cityId: 'windsor', boundaryId: 'nope' })).rejects.toThrow(/not found/);
  });

  it('ties the BIA workspace to its boundary', async () => {
    const s = createMockServices();
    expect((await s.workspaces.workspace(BIA))?.boundaryId).toBe(CORRIDOR);
    expect((await s.boundaries.get(CORRIDOR))?.properties.name).toMatch(/Olde Riverside/);
    expect(await s.boundaries.get('nope')).toBeNull();
  });
});

describe('connected journey: community issue -> BIA action -> visible outcome', () => {
  it('carries one issue through every step and every screen reads the result', async () => {
    const s = createMockServices();

    // 1. A neighbour reports an issue inside the corridor.
    const issue = await s.social.reportIssue({ title: 'Broken bench on Wyandotte', summary: '', cityId: 'windsor', coordinates: IN_CORRIDOR });
    const signals = await s.objects.list({ cityId: 'windsor', kinds: ['issue'], boundaryId: CORRIDOR });
    expect(signals.some((o) => o.id === issue.id)).toBe(true);

    // 2. The BIA takes it on. The issue and the reporter's notifications change.
    const task = await s.workspaces.raiseTaskFromIssue(BIA, issue.id);
    expect(task).toMatchObject({ sourceObjectId: issue.id, status: 'open', workspaceId: BIA });
    expect((await s.objects.get(issue.id))?.status).toBe('Acknowledged');
    expect((await s.objects.get(issue.id))?.handledBy).toEqual({ workspaceId: BIA, taskId: task.id });
    expect((await s.social.notifications())[0]?.title).toMatch(/acknowledged/);

    // 3. Progress carries back to the issue.
    await s.workspaces.updateTask(BIA, task.id, 'in-progress');
    expect((await s.objects.get(issue.id))?.status).toBe('In progress');
    expect((await s.objects.get(issue.id))?.outcome).toBeUndefined();

    // 4. Done: a visible outcome is published on the issue and the reporter is told.
    await s.workspaces.updateTask(BIA, task.id, 'done');
    const resolved = await s.objects.get(issue.id);
    expect(resolved?.status).toBe('Resolved');
    expect(resolved?.outcome?.summary).toMatch(/Sample Olde Riverside BIA/);
    const notes = await s.social.notifications();
    expect(notes.map((n) => n.title)).toEqual(expect.arrayContaining(['Your report was acknowledged', 'Work has started', 'Your issue was resolved']));
    expect(notes.every((n) => n.href === `/map?sel=${issue.id}` || n.href.startsWith('/map?sel=w-'))).toBe(true);
  });

  it('keeps the seeded roadworks loop working: finishing its task resolves the issue', async () => {
    const s = createMockServices();
    expect((await s.objects.get('w-roadworks'))?.handledBy?.taskId).toBe('t-bia-works');
    await s.workspaces.updateTask(BIA, 't-bia-works', 'done');
    const o = await s.objects.get('w-roadworks');
    expect(o?.status).toBe('Resolved');
    expect(o?.outcome).toBeDefined();
  });

  it('enforces the rules: boundary, one handler, issues only, BIA only', async () => {
    const s = createMockServices();
    const outside = await s.social.reportIssue({ title: 'Pothole downtown', summary: '', cityId: 'windsor', coordinates: DOWNTOWN });
    await expect(s.workspaces.raiseTaskFromIssue(BIA, outside.id)).rejects.toThrow(/outside the BIA boundary/);
    await expect(s.workspaces.raiseTaskFromIssue(BIA, 'w-roadworks')).rejects.toThrow(/already being handled/);
    await expect(s.workspaces.raiseTaskFromIssue(BIA, 'w-bakery')).rejects.toThrow(/community issue/);
    await expect(s.workspaces.raiseTaskFromIssue('ws-biz-bakery', 'w-sidewalk')).rejects.toThrow(/BIA workspace/);
    await expect(s.workspaces.raiseTaskFromIssue('nope', 'w-sidewalk')).rejects.toThrow(/not found/);
    await expect(s.workspaces.raiseTaskFromIssue(BIA, 'nope')).rejects.toThrow(/not found/);
    const ok = await s.workspaces.raiseTaskFromIssue(BIA, 'w-sidewalk');
    await expect(s.workspaces.raiseTaskFromIssue(BIA, 'w-sidewalk')).rejects.toThrow(/already being handled/);
    expect(ok.sourceObjectId).toBe('w-sidewalk');
  });
});

describe('session persistence: state survives a new service instance (a full page load)', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('restores reports, tasks and outcomes when services are created again with the same key', async () => {
    const first = createMockServices({ persistKey: 'test-session' });
    const issue = await first.social.reportIssue({ title: 'Persisted issue', summary: '', cityId: 'windsor', coordinates: IN_CORRIDOR });
    const task = await first.workspaces.raiseTaskFromIssue(BIA, issue.id);
    await first.workspaces.updateTask(BIA, task.id, 'in-progress');

    const second = createMockServices({ persistKey: 'test-session' });
    expect((await second.objects.get(issue.id))?.status).toBe('In progress');
    expect((await second.workspaces.tasks(BIA)).some((t) => t.id === task.id && t.status === 'in-progress')).toBe(true);
    expect((await second.social.notifications()).some((n) => n.title === 'Work has started')).toBe(true);
  });

  it('keeps instances without a key isolated, and ignores a corrupt snapshot', async () => {
    const a = createMockServices();
    await a.social.reportIssue({ title: 'Zxqvunique marker', summary: '', cityId: 'windsor' });
    expect((await createMockServices().objects.list({ cityId: 'windsor', text: 'Zxqvunique' })).length).toBe(0);
    window.sessionStorage.setItem('bad', '{not json');
    const s = createMockServices({ persistKey: 'bad' });
    expect((await s.objects.list({ cityId: 'windsor' })).length).toBe(22);
  });
});
