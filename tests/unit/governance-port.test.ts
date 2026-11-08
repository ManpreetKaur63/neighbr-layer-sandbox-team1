import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { createGovStore } from '@/services/mock/governance';
import type { GovActor } from '@/lib/governance';

const OFFICE = 'ws-ward-sample';
const WORKS = 'ws-dept-works';
const PARKS = 'ws-dept-parks';

const actor = (id: string, name: string, workspaceId: string, role: GovActor['role'], memberStatus: GovActor['memberStatus'] = 'active'): GovActor => ({
  id, name, workspaceId, role, memberStatus,
});
const chief = actor('m-ward-1', 'Demo chief of staff', OFFICE, 'owner');
const clerk = actor('m-ward-2', 'Demo constituent services officer', OFFICE, 'staff');
const comms = actor('m-ward-3', 'Demo communications officer', OFFICE, 'staff');
const intern = actor('m-ward-4', 'Demo policy intern', OFFICE, 'member');
const worksMgr = actor('m-works-1', 'Demo works manager', WORKS, 'owner');
const worksSup = actor('m-works-2', 'Demo works supervisor', WORKS, 'staff');

/** A fresh store per test, so nothing leaks between them. */
function fresh() {
  return createMockServices({ requestStore: undefined, governanceStore: createGovStore() });
}

describe('governance seed (M07)', () => {
  it('seeds two offices and four departments across all three access states', async () => {
    const all = await fresh().workspaces.workspaces();
    const of = (k: string) => all.filter((w) => w.kind === k);
    expect(of('office')).toHaveLength(2);
    expect(of('department')).toHaveLength(4);
    expect(new Set([...of('office'), ...of('department')].map((w) => w.status))).toEqual(new Set(['verified', 'onboarding', 'restricted']));
  });

  it('every office and department has an owner, staff, and an invited person; tasks exist', async () => {
    const s = fresh();
    for (const w of (await s.workspaces.workspaces()).filter((x) => x.kind === 'office' || x.kind === 'department')) {
      const m = await s.workspaces.members(w.id);
      expect(m.some((x) => x.role === 'owner' && x.status === 'active'), w.id).toBe(true);
      expect(m.some((x) => x.status === 'invited'), w.id).toBe(true);
      expect((await s.workspaces.tasks(w.id)).length, w.id).toBeGreaterThan(0);
    }
  });

  it('the fixture ward object now points at a real workspace (closes I5)', async () => {
    const s = fresh();
    const ward = await s.objects.get('w-ward');
    expect(ward?.workspaceId).toBe(OFFICE);
    expect(await s.workspaces.workspace(OFFICE)).not.toBeNull();
  });

  it('covers every publication state and every case state', async () => {
    const s = fresh();
    const all = [...(await s.governance.communications(OFFICE)), ...(await s.governance.communications(WORKS))];
    expect(new Set(all.map((m) => m.state))).toEqual(new Set(['draft', 'in-review', 'returned', 'published', 'withdrawn']));
    const cases = await s.governance.cases({ officeId: OFFICE });
    expect(new Set(cases.map((c) => c.status))).toEqual(new Set(['received', 'routed', 'in-progress', 'returned', 'closed']));
  });

  it('the seeded audit record has no gaps and includes a refusal', async () => {
    const s = fresh();
    const audit = [...(await s.governance.audit(OFFICE))].reverse();
    expect(audit.length).toBeGreaterThan(5);
    expect(audit.some((e) => e.outcome === 'denied')).toBe(true);
  });
});

describe('case routing (M07)', () => {
  it('office logs a case, routes it, the department accepts and closes it; each step is audited', async () => {
    const s = fresh();
    const c = await s.governance.createCase({ title: 'Broken bollard on Elm Lane', summary: 'Demo.', source: 'inquiry', priority: 'routine' }, clerk);
    expect(c.status).toBe('received');
    expect(c.reference).toBe('CASE-1007');

    const routed = await s.governance.routeCase(c.id, WORKS, clerk, 'Please look at this week.');
    expect(routed).toMatchObject({ status: 'routed', departmentId: WORKS });
    // The department sees it, and another department does not.
    expect((await s.governance.cases({ departmentId: WORKS })).some((x) => x.id === c.id)).toBe(true);
    expect((await s.governance.cases({ departmentId: PARKS })).some((x) => x.id === c.id)).toBe(false);

    const accepted = await s.governance.caseStep(c.id, 'accept', worksSup);
    expect(accepted).toMatchObject({ status: 'in-progress', assignee: { id: 'm-works-2' } });
    const closed = await s.governance.caseStep(c.id, 'close', worksSup, 'Bollard replaced.');
    expect(closed.status).toBe('closed');

    const trail = (await s.governance.audit(OFFICE)).filter((e) => e.targetId === c.id).reverse();
    expect(trail.map((e) => e.action)).toEqual(['case-created', 'case-routed', 'case-accepted', 'case-closed']);
    expect(trail.every((e) => e.outcome === 'done')).toBe(true);
    // The department sees the routing and its own steps, not the office's creation.
    const deptTrail = (await s.governance.audit(WORKS)).filter((e) => e.targetId === c.id);
    expect(deptTrail.map((e) => e.action).sort()).toEqual(['case-accepted', 'case-closed', 'case-routed']);
  });

  it('a department returns a case with a reason, and the office can route it again', async () => {
    const s = fresh();
    const [routed] = (await s.governance.cases({ departmentId: WORKS })).filter((c) => c.status === 'routed');
    expect(routed).toBeDefined();
    await expect(s.governance.caseStep(routed!.id, 'return', worksSup, '   ')).rejects.toThrow(/Say why/);
    const back = await s.governance.caseStep(routed!.id, 'return', worksSup, 'Not a works matter.');
    expect(back.status).toBe('returned');
    expect(back.departmentId).toBeUndefined();
    const again = await s.governance.routeCase(routed!.id, PARKS, clerk);
    expect(again).toMatchObject({ status: 'routed', departmentId: PARKS });
  });

  it('refuses to route to a restricted or an onboarding department, and records the refusal', async () => {
    const s = fresh();
    const before = (await s.governance.audit(OFFICE)).length;
    await expect(s.governance.routeCase('case-1001', 'ws-dept-licensing', clerk)).rejects.toThrow(/Not allowed: .*restricted/);
    await expect(s.governance.routeCase('case-1001', 'ws-dept-transit', clerk)).rejects.toThrow(/Not allowed: .*onboarding/);
    const audit = await s.governance.audit(OFFICE);
    expect(audit.length).toBe(before + 2);
    expect(audit.slice(0, 2).every((e) => e.outcome === 'denied' && e.action === 'case-routed')).toBe(true);
    // The case did not move.
    expect((await s.governance.getCase('case-1001'))?.status).toBe('received');
  });

  it('refuses steps from the wrong side, the wrong state, the wrong role and an unaccepted invitation', async () => {
    const s = fresh();
    await expect(s.governance.routeCase('case-1001', WORKS, intern)).rejects.toThrow(/Not allowed/);
    await expect(s.governance.routeCase('case-1001', WORKS, { ...clerk, memberStatus: 'invited' })).rejects.toThrow(/invitation/);
    // A department cannot route; an office cannot accept.
    await expect(s.governance.routeCase('case-1001', WORKS, worksSup)).rejects.toThrow(/Not allowed/);
    await expect(s.governance.caseStep('case-1002', 'accept', clerk)).rejects.toThrow(/Not allowed/);
    // Another department cannot touch a case routed to Works.
    await expect(s.governance.caseStep('case-1002', 'accept', actor('m-parks-2', 'Demo parks supervisor', PARKS, 'staff'))).rejects.toThrow(/department the case is routed to/);
    // Wrong state: closing a case that was only routed.
    await expect(s.governance.caseStep('case-1002', 'close', worksSup, 'done')).rejects.toThrow(/cannot take this step/);
    // An observer cannot work.
    await expect(s.governance.caseStep('case-1002', 'accept', actor('m-works-4', 'Demo works observer', WORKS, 'member'))).rejects.toThrow(/Not allowed/);
  });

  it('a restricted workspace is read-only for cases', async () => {
    const s = fresh();
    await expect(
      s.governance.createCase({ title: 'x', summary: '', source: 'inquiry', priority: 'routine' }, actor('m-lic-2', 'Demo licensing officer', 'ws-dept-licensing', 'staff')),
    ).rejects.toThrow(/Not allowed/);
  });

  it('only an office logs cases, and a case needs a title', async () => {
    const s = fresh();
    await expect(s.governance.createCase({ title: 'x', summary: '', source: 'inquiry', priority: 'routine' }, worksSup)).rejects.toThrow(/Only a public office/);
    await expect(s.governance.createCase({ title: '   ', summary: '', source: 'inquiry', priority: 'routine' }, clerk)).rejects.toThrow(/needs a title/);
  });

  it('refuses to close a case while a response to it is still in review, and records it', async () => {
    const s = fresh();
    const c = (await s.governance.cases({ departmentId: WORKS })).find((x) => x.id === 'case-1002')!;
    await s.governance.caseStep(c.id, 'accept', worksSup);
    const draft = (await s.governance.communications(WORKS)).find((m) => m.caseId === c.id && m.state === 'draft')!;
    await s.governance.communicationStep(draft.id, 'submit', worksSup);
    await expect(s.governance.caseStep(c.id, 'close', worksSup, 'Done.')).rejects.toThrow(/still in review/);
    await s.governance.communicationStep(draft.id, 'approve', worksMgr);
    expect((await s.governance.caseStep(c.id, 'close', worksSup, 'Done.')).status).toBe('closed');
  });
});

describe('publication states and four-eyes (M07)', () => {
  it('draft → in review → published: only then is it on the public feed', async () => {
    const s = fresh();
    const m = await s.governance.createCommunication({ workspaceId: OFFICE, title: 'Market parking', body: 'Parking changes on Saturday (demo).' }, comms);
    expect(m.state).toBe('draft');
    const inFeed = async () => (await s.governance.publicFeed(OFFICE)).some((x) => x.id === m.id);
    expect(await inFeed()).toBe(false);
    await s.governance.communicationStep(m.id, 'submit', comms);
    expect(await inFeed()).toBe(false);
    const published = await s.governance.communicationStep(m.id, 'approve', chief);
    expect(published).toMatchObject({ state: 'published', reviewerName: 'Demo chief of staff' });
    expect(published.publishedAt).toBeTruthy();
    expect(await inFeed()).toBe(true);
  });

  it('the public feed never includes draft, in-review, returned or withdrawn items', async () => {
    const s = fresh();
    const feed = await s.governance.publicFeed(OFFICE);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((m) => m.state === 'published')).toBe(true);
    const titles = feed.map((m) => m.title);
    expect(titles).not.toContain('Winter parking reminder');
    expect(titles).not.toContain('Riverside Drive lane closure this week');
    expect(titles).not.toContain('Holiday office hours');
    expect(titles).not.toContain('Detour map for the corridor (replaced)');
  });

  it('a department response to an office case appears on that office feed once published', async () => {
    const s = fresh();
    const feed = await s.governance.publicFeed(OFFICE);
    expect(feed.some((m) => m.id === 'comm-5' && m.workspaceId === WORKS)).toBe(true);
    // A draft response from the same department stays off it.
    expect(feed.some((m) => m.id === 'comm-6')).toBe(false);
  });

  it('the author cannot approve their own item: refused, recorded, and the item stays in review', async () => {
    const s = fresh();
    const m = await s.governance.createCommunication({ workspaceId: OFFICE, title: 'Self approved?', body: 'Demo.' }, chief);
    await s.governance.communicationStep(m.id, 'submit', chief);
    const before = (await s.governance.audit(OFFICE)).length;
    await expect(s.governance.communicationStep(m.id, 'approve', chief)).rejects.toThrow(/Not allowed: Four-eyes/);
    const audit = await s.governance.audit(OFFICE);
    expect(audit.length).toBe(before + 1);
    expect(audit[0]).toMatchObject({ outcome: 'denied', action: 'comm-approved', actorId: 'm-ward-1', fromState: 'in-review' });
    expect(audit[0]?.toState).toBeUndefined();
    expect((await s.governance.communications(OFFICE)).find((x) => x.id === m.id)?.state).toBe('in-review');
  });

  it('staff cannot approve, return or withdraw; only the owner can', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-2', 'approve', clerk)).rejects.toThrow(/owner role/);
    await expect(s.governance.communicationStep('comm-2', 'return', clerk, 'x')).rejects.toThrow(/Not allowed/);
    await expect(s.governance.communicationStep('comm-1', 'withdraw', comms, 'x')).rejects.toThrow(/Not allowed/);
    expect((await s.governance.communicationStep('comm-2', 'return', chief, 'Add a date.')).state).toBe('returned');
  });

  it('return and withdraw need a reason; a returned item can be resubmitted; a withdrawn one leaves the feed', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-2', 'return', chief, ' ')).rejects.toThrow(/what needs to change/i);
    const r = await s.governance.communicationStep('comm-2', 'return', chief, 'Add the road name.');
    expect(r).toMatchObject({ state: 'returned', reviewNote: 'Add the road name.' });
    const again = await s.governance.communicationStep('comm-2', 'submit', comms);
    expect(again.state).toBe('in-review');
    expect(again.reviewNote).toBeUndefined();

    await expect(s.governance.communicationStep('comm-1', 'withdraw', chief, '')).rejects.toThrow(/why/i);
    const w = await s.governance.communicationStep('comm-1', 'withdraw', chief, 'Meeting moved.');
    expect(w.state).toBe('withdrawn');
    expect((await s.governance.publicFeed(OFFICE)).some((m) => m.id === 'comm-1')).toBe(false);
  });

  it('steps follow the allowed paths only', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-3', 'approve', chief)).rejects.toThrow(/in review/);
    await expect(s.governance.communicationStep('comm-1', 'submit', comms)).rejects.toThrow(/cannot take this step/);
  });

  it('an onboarding office can draft but cannot publish; a restricted department cannot write', async () => {
    const s = fresh();
    const lead = actor('m-dep-1', 'Demo deputy office lead', 'ws-office-deputy', 'owner');
    const other = actor('m-dep-3', 'Demo deputy writer', 'ws-office-deputy', 'staff');
    const m = await s.governance.createCommunication({ workspaceId: 'ws-office-deputy', title: 'Hello', body: 'Demo.' }, other);
    await s.governance.communicationStep(m.id, 'submit', other);
    await expect(s.governance.communicationStep(m.id, 'approve', lead)).rejects.toThrow(/verified/);
    await expect(
      s.governance.createCommunication({ workspaceId: 'ws-dept-licensing', title: 'x', body: 'y' }, actor('m-lic-2', 'Demo licensing officer', 'ws-dept-licensing', 'staff')),
    ).rejects.toThrow(/restricted/);
  });

  it('a response must belong to a case the workspace handles; an unknown case rejects', async () => {
    const s = fresh();
    await expect(
      s.governance.createCommunication({ workspaceId: WORKS, title: 'x', body: 'y', caseId: 'case-1003' }, worksSup),
    ).rejects.toThrow(/not handling that case/);
    await expect(s.governance.createCommunication({ workspaceId: WORKS, title: 'x', body: 'y', caseId: 'nope' }, worksSup)).rejects.toThrow(/not found/);
    const ok = await s.governance.createCommunication({ workspaceId: WORKS, title: 'Update', body: 'We are on it.', caseId: 'case-1002' }, worksSup);
    expect(ok).toMatchObject({ kind: 'response', caseId: 'case-1002', state: 'draft' });
  });

  it('validates title and text, and an actor cannot write in another workspace', async () => {
    const s = fresh();
    await expect(s.governance.createCommunication({ workspaceId: OFFICE, title: ' ', body: 'x' }, comms)).rejects.toThrow(/needs a title/);
    await expect(s.governance.createCommunication({ workspaceId: OFFICE, title: 'x', body: ' ' }, comms)).rejects.toThrow(/needs some text/);
    await expect(s.governance.createCommunication({ workspaceId: OFFICE, title: 'x', body: 'y'.repeat(1001) }, comms)).rejects.toThrow(/1000/);
    await expect(s.governance.createCommunication({ workspaceId: OFFICE, title: 'x', body: 'y' }, worksSup)).rejects.toThrow(/Not allowed/);
  });
});

describe('the audit record (M07)', () => {
  it('is append-only: sequence numbers rise by one and earlier entries never change', async () => {
    const store = createGovStore();
    const s = createMockServices({ governanceStore: store });
    const snapshot = JSON.stringify(store.audit);
    await s.governance.createCase({ title: 'One', summary: '', source: 'office', priority: 'routine' }, clerk);
    await expect(s.governance.routeCase('case-1001', 'ws-dept-transit', clerk)).rejects.toThrow();
    expect(JSON.stringify(store.audit.slice(0, JSON.parse(snapshot).length))).toBe(snapshot);
    const seqs = store.audit.map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });

  it('exposes no way to edit or delete an entry', () => {
    const s = fresh();
    expect(Object.keys(s.governance).filter((k) => /audit/i.test(k))).toEqual(['audit']);
    expect(Object.keys(s.governance).some((k) => /delete|remove|edit|update/i.test(k))).toBe(false);
  });

  it('shows each workspace only what involves it', async () => {
    const s = fresh();
    const parks = await s.governance.audit(PARKS);
    expect(parks.length).toBeGreaterThan(0);
    expect(parks.every((e) => e.visibleTo.includes(PARKS))).toBe(true);
    expect(parks.some((e) => e.targetId === 'case-1004')).toBe(false);
  });

  it('records who, which role, what, and the states; a refusal says why', async () => {
    const s = fresh();
    await s.governance.routeCase('case-1001', WORKS, clerk);
    await expect(s.governance.routeCase('case-1006', 'ws-dept-licensing', clerk)).rejects.toThrow();
    const [refusal, done] = await s.governance.audit(OFFICE);
    expect(done).toMatchObject({ actorName: clerk.name, actorRole: 'staff', outcome: 'done', fromState: 'received', toState: 'routed' });
    expect(refusal).toMatchObject({ outcome: 'denied' });
    expect(refusal?.detail).toMatch(/^Not allowed: /);
  });

  it('unknown workspaces, cases and communications reject without writing anything', async () => {
    const store = createGovStore();
    const s = createMockServices({ governanceStore: store });
    const n = store.audit.length;
    await expect(s.governance.audit('nope')).rejects.toThrow(/not found/);
    await expect(s.governance.routeCase('nope', WORKS, clerk)).rejects.toThrow(/not found/);
    await expect(s.governance.communicationStep('nope', 'submit', clerk)).rejects.toThrow(/not found/);
    expect(await s.governance.getCase('nope')).toBeNull();
    expect(store.audit.length).toBe(n);
  });

  it('two stores do not share state', async () => {
    const a = createMockServices({ governanceStore: createGovStore() });
    const b = createMockServices({ governanceStore: createGovStore() });
    await a.governance.createCase({ title: 'Only in A', summary: '', source: 'office', priority: 'routine' }, clerk);
    expect((await a.governance.cases({ officeId: OFFICE })).length).toBe((await b.governance.cases({ officeId: OFFICE })).length + 1);
  });
});
