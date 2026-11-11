import { describe, expect, it } from 'vitest';
import { createMockServices, type MockOptions } from '@/services/mock';
import type { GovActor } from '@/lib/governance';
import type { GovCase } from '@/lib/schemas';
import { appGovStore, createGovStore } from '@/services/mock/governance';

/* Merged tree (Nov 11, 2026): there is no ward office and no separate 'office'/'department' kind.
 * Public Works is the only verified department and plays both roles — it logs cases (office side) and
 * works them (department side). Parks & Recreation is a 'government' workspace too, but it is onboarding
 * and cannot take cases, so it is the refusal target in these tests. There is no restricted tenant, so
 * the restricted-state tests from the office model are dropped here (the rule itself is still covered
 * by governance-rules.test.ts and permissions.test.ts). */

const PW = 'ws-gov-public-works';
const PARKS = 'ws-gov-parks';

const actor = (id: string, name: string, workspaceId: string, role: GovActor['role'], over: Partial<GovActor> = {}): GovActor => ({
  id, name, workspaceId, role, memberStatus: 'active', ...over,
});

// The merged tree has one owner and one active staff member in Public Works, so several test roles
// share them. The port only checks the actor's stated role/status, not the fixture roster.
const chief = actor('m-gov-1', 'Demo public works head', PW, 'owner');
const clerk = actor('m-gov-2', 'Demo public works staff', PW, 'staff');
const intern = actor('m-gov-3', 'Demo partner organization', PW, 'member');
const parksHead = actor('m-prk-1', 'Demo parks head', PARKS, 'owner');

function fresh() {
  const store = createGovStore();
  return createMockServices({ governanceStore: store } as MockOptions);
}

describe('the seeded governance record (merged model)', () => {
  it('seeds two government workspaces: Public Works verified, Parks onboarding', async () => {
    const all = await fresh().workspaces.workspaces();
    const gov = all.filter((w) => w.kind === 'government');
    expect(gov.map((w) => w.id).sort()).toEqual(['ws-gov-parks', 'ws-gov-public-works']);
    expect(new Set(gov.map((w) => w.status))).toEqual(new Set(['verified', 'onboarding']));
  });

  it('every government workspace has an active owner, an invited person, and tasks', async () => {
    const s = fresh();
    for (const w of (await s.workspaces.workspaces()).filter((x) => x.kind === 'government')) {
      const m = await s.workspaces.members(w.id);
      expect(m.some((x) => x.role === 'owner' && x.status === 'active'), w.id).toBe(true);
      expect(m.some((x) => x.status === 'invited'), w.id).toBe(true);
      expect((await s.workspaces.tasks(w.id)).length, w.id).toBeGreaterThan(0);
    }
  });

  it('the fixture ward object now points at a real workspace (closes I5)', async () => {
    const s = fresh();
    const ward = await s.objects.get('w-ward');
    expect(ward?.workspaceId).toBe(PW);
    expect(await s.workspaces.workspace(PW)).not.toBeNull();
  });

  it('covers every publication state and every case state', async () => {
    const s = fresh();
    const comms = await s.governance.communications(PW);
    expect(new Set(comms.map((m) => m.state))).toEqual(new Set(['draft', 'in-review', 'published', 'returned', 'withdrawn']));
    const cases = await s.governance.cases({ officeId: PW });
    expect(new Set(cases.map((c) => c.status))).toEqual(new Set(['received', 'routed', 'in-progress', 'closed', 'returned']));
  });

  it('the seeded audit record has no gaps and includes a refusal', async () => {
    const s = fresh();
    const a = await s.governance.audit(PW);
    expect(a.length).toBeGreaterThan(5);
    expect(a.some((e) => e.outcome === 'denied')).toBe(true);
    expect(a.every((e) => e.seq > 0)).toBe(true);
  });
});

describe('case routing in the merged model', () => {
  it('the office logs a case, routes it, the department accepts and closes it; each step is audited', async () => {
    const s = fresh();
    const c = await s.governance.createCase(
      { title: 'A loose bollard', summary: 'The bollard outside the sample bakery is loose.', source: 'resident-report', priority: 'routine' },
      clerk,
    );
    expect(c.reference).toBe('CASE-1007');
    expect(c.status).toBe('received');

    const routed = await s.governance.routeCase(c.id, PW, clerk);
    expect(routed.status).toBe('routed');
    expect(routed.departmentId).toBe(PW);
    const mine = await s.governance.cases({ departmentId: PW });
    expect(mine.some((x) => x.id === c.id)).toBe(true);
    expect((await s.governance.cases({ departmentId: PARKS })).some((x) => x.id === c.id)).toBe(false);

    const accepted = await s.governance.caseStep(c.id, 'accept', clerk);
    expect(accepted.status).toBe('in-progress');
    expect(accepted.assignee).toEqual({ id: 'm-gov-2', name: 'Demo public works staff' });

    const closed = await s.governance.caseStep(c.id, 'close', clerk, 'Bollard replaced.');
    expect(closed.status).toBe('closed');
    // The close note is not stored on the case; it is written into the audit record.
    const closeEntry = (await s.governance.audit(PW)).find((e) => e.targetId === c.id && e.action === 'case-closed');
    expect(closeEntry?.detail).toBe('Closed: Bollard replaced.');

    const trail = (await s.governance.audit(PW)).filter((e) => e.targetId === c.id).reverse();
    expect(trail.map((e) => e.action)).toEqual(['case-created', 'case-routed', 'case-accepted', 'case-closed']);
    // The office and the department are the same workspace here, so the creation is visible to the
    // department view too — unlike the office model, where it was office-only.
    const deptTrail = (await s.governance.audit(PW)).filter((e) => e.targetId === c.id);
    expect(deptTrail.map((e) => e.action).sort()).toEqual(['case-accepted', 'case-closed', 'case-created', 'case-routed']);
  });

  it('a department returns a case with a reason, and the office can route it again', async () => {
    const s = fresh();
    const routed = (await s.governance.cases({ departmentId: PW })).find((c) => c.status === 'routed');
    expect(routed).toBeDefined();
    await expect(s.governance.caseStep(routed!.id, 'return', clerk, '   ')).rejects.toThrow(/Say why/);
    const returned = await s.governance.caseStep(routed!.id, 'return', clerk, 'Not a works matter.');
    expect(returned.status).toBe('returned');
    expect(returned.departmentId).toBeUndefined();
    const routedAgain = await s.governance.routeCase(routed!.id, PW, clerk);
    expect(routedAgain.status).toBe('routed');
    expect(routedAgain.departmentId).toBe(PW);
  });

  it('refuses to route to an onboarding department, and records the refusal', async () => {
    const s = fresh();
    const before = (await s.governance.audit(PW)).length;
    await expect(s.governance.routeCase('case-1001', PARKS, clerk)).rejects.toThrow(/Not allowed: .*onboarding/);
    const after = await s.governance.audit(PW);
    expect(after.length).toBe(before + 1);
    expect(after.slice(0, 1)).toMatchObject([{ outcome: 'denied', action: 'case-routed' }]);
    expect((await s.governance.getCase('case-1001'))?.status).toBe('received');
  });

  it('refuses steps from the wrong side, the wrong state, the wrong role and an unaccepted invitation', async () => {
    const s = fresh();
    // A member cannot work cases at all.
    await expect(s.governance.routeCase('case-1001', PW, intern)).rejects.toThrow(/Not allowed/);
    // An invited person cannot act until the invitation is accepted.
    await expect(s.governance.routeCase('case-1001', PW, { ...clerk, memberStatus: 'invited' })).rejects.toThrow(/invitation/);
    // Parks did not receive this case, so it cannot route it.
    await expect(s.governance.routeCase('case-1001', PW, parksHead)).rejects.toThrow(/Not allowed/);
    // Parks is not the department the case is routed to, so it cannot accept it.
    await expect(s.governance.caseStep('case-1002', 'accept', parksHead)).rejects.toThrow(/department the case is routed to/);
    // A routed case cannot be closed yet.
    await expect(s.governance.caseStep('case-1002', 'close', clerk, 'done')).rejects.toThrow(/cannot take this step/);
    // A member cannot accept a case.
    await expect(s.governance.caseStep('case-1002', 'accept', intern)).rejects.toThrow(/Not allowed/);
  });

  it('only a government workspace logs cases, and a case needs a title', async () => {
    const s = fresh();
    const bizActor = actor('m-bak-1', 'Demo bakery owner', 'ws-biz-bakery', 'owner');
    await expect(
      s.governance.createCase({ title: 'x', summary: '', source: 'inquiry', priority: 'routine' }, bizActor),
    ).rejects.toThrow(/Only a government workspace/);
    await expect(
      s.governance.createCase({ title: '  ', summary: '', source: 'inquiry', priority: 'routine' }, clerk),
    ).rejects.toThrow(/needs a title/);
  });

  it('refuses to close a case while a response to it is still in review, and records it', async () => {
    const s = fresh();
    const c = (await s.governance.cases({ departmentId: PW })).find((x) => x.id === 'case-1002');
    expect(c?.status).toBe('routed');
    await s.governance.caseStep('case-1002', 'accept', clerk);
    const draft = (await s.governance.communications(PW)).find((m) => m.id === 'comm-6');
    expect(draft?.state).toBe('draft');
    await s.governance.communicationStep('comm-6', 'submit', clerk);
    await expect(s.governance.caseStep('case-1002', 'close', clerk, 'done')).rejects.toThrow(/still in review/);
    const approved = await s.governance.communicationStep('comm-6', 'approve', chief);
    expect(approved.state).toBe('published');
    const closed = await s.governance.caseStep('case-1002', 'close', clerk, 'done');
    expect(closed.status).toBe('closed');
  });
});

describe('publication and the four-eyes rule', () => {
  it('draft → in review → published: only then is it on the public feed', async () => {
    const s = fresh();
    const draft = await s.governance.createCommunication({ workspaceId: PW, title: 'Water shutoff on Tuesday', body: 'From 9am to 1pm.' }, clerk);
    expect(draft.state).toBe('draft');
    expect(draft.kind).toBe('notice');
    await expect(s.governance.publicFeed(PW)).resolves.not.toContainEqual(expect.objectContaining({ id: draft.id }));
    const review = await s.governance.communicationStep(draft.id, 'submit', clerk);
    expect(review.state).toBe('in-review');
    const published = await s.governance.communicationStep(draft.id, 'approve', chief);
    expect(published.state).toBe('published');
    expect(published.reviewerName).toBe('Demo public works head');
    await expect(s.governance.publicFeed(PW)).resolves.toContainEqual(expect.objectContaining({ id: draft.id }));
  });

  it('the public feed never includes draft, in-review, returned or withdrawn items', async () => {
    const s = fresh();
    const feed = await s.governance.publicFeed(PW);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((m) => m.state === 'published')).toBe(true);
    for (const t of ['Winter parking reminder', 'Riverside Drive lane closure this week', 'Holiday office hours', 'Detour map for the corridor (replaced)']) {
      expect(feed.map((m) => m.title)).not.toContain(t);
    }
  });

  it('a department response to an office case appears on that office feed once published', async () => {
    const s = fresh();
    const feed = await s.governance.publicFeed(PW);
    expect(feed.map((m) => m.title)).toContain('Streetlight repaired on the sample block');
    expect(feed.map((m) => m.title)).not.toContain('Work starts Monday, signs go up Friday');
  });

  it('the author cannot approve their own item, and the refusal is recorded', async () => {
    const s = fresh();
    const draft = await s.governance.createCommunication({ workspaceId: PW, title: 'My own notice', body: 'Written by the head.' }, chief);
    await s.governance.communicationStep(draft.id, 'submit', chief);
    const before = (await s.governance.audit(PW)).length;
    await expect(s.governance.communicationStep(draft.id, 'approve', chief)).rejects.toThrow(/Not allowed: Four-eyes/);
    const after = await s.governance.audit(PW);
    expect(after.length).toBe(before + 1);
    expect(after.slice(0, 1)).toMatchObject([{ outcome: 'denied', action: 'comm-approved', actorId: 'm-gov-1' }]);
    expect((await s.governance.communications(PW)).find((m) => m.id === draft.id)?.state).toBe('in-review');
  });

  it('staff cannot approve, return or withdraw; only the owner can', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-2', 'approve', clerk)).rejects.toThrow(/owner role/);
    await expect(s.governance.communicationStep('comm-2', 'return', clerk, 'fix it')).rejects.toThrow(/Not allowed/);
    await expect(s.governance.communicationStep('comm-1', 'withdraw', clerk, 'no longer true')).rejects.toThrow(/Not allowed/);
    const returned = await s.governance.communicationStep('comm-2', 'return', chief, 'Add a date.');
    expect(returned.state).toBe('returned');
  });

  it('return and withdraw need a reason, and a returned item can be resubmitted', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-2', 'return', chief, ' ')).rejects.toThrow(/what needs to change/i);
    const returned = await s.governance.communicationStep('comm-2', 'return', chief, 'Add the exact dates.');
    expect(returned.reviewNote).toBe('Add the exact dates.');
    const resubmitted = await s.governance.communicationStep('comm-2', 'submit', clerk);
    expect(resubmitted.state).toBe('in-review');
    expect(resubmitted.reviewNote).toBeUndefined();
    await expect(s.governance.communicationStep('comm-1', 'withdraw', chief, '')).rejects.toThrow(/why/i);
    const withdrawn = await s.governance.communicationStep('comm-1', 'withdraw', chief, 'The meeting date changed.');
    expect(withdrawn.state).toBe('withdrawn');
    expect((await s.governance.publicFeed(PW)).map((m) => m.id)).not.toContain('comm-1');
  });

  it('steps follow the allowed paths only', async () => {
    const s = fresh();
    await expect(s.governance.communicationStep('comm-3', 'approve', chief)).rejects.toThrow(/in review/);
    await expect(s.governance.communicationStep('comm-1', 'submit', clerk)).rejects.toThrow(/cannot take this step/);
  });

  it('an onboarding department can draft but cannot publish', async () => {
    const s = fresh();
    const draft = await s.governance.createCommunication({ workspaceId: PARKS, title: 'Trail reopening', body: 'From Monday.' }, parksHead);
    expect(draft.state).toBe('draft');
    await s.governance.communicationStep(draft.id, 'submit', parksHead);
    await expect(s.governance.communicationStep(draft.id, 'approve', parksHead)).rejects.toThrow(/verified/);
  });

  it('a response must belong to a case the workspace handles; an unknown case rejects', async () => {
    const s = fresh();
    const parksCase = await s.governance.createCase(
      { title: 'Parks question', summary: '', source: 'inquiry', priority: 'routine' },
      parksHead,
    );
    expect(parksCase.officeId).toBe(PARKS);
    await expect(
      s.governance.createCommunication({ workspaceId: PW, title: 'x', body: 'y', caseId: parksCase.id }, clerk),
    ).rejects.toThrow(/not handling that case/);
    await expect(
      s.governance.createCommunication({ workspaceId: PW, title: 'x', body: 'y', caseId: 'nope' }, clerk),
    ).rejects.toThrow(/not found/);
    const ok = await s.governance.createCommunication({ workspaceId: PW, title: 'x', body: 'y', caseId: 'case-1002' }, clerk);
    expect(ok.kind).toBe('response');
    expect(ok.caseId).toBe('case-1002');
    expect(ok.state).toBe('draft');
  });

  it('validates title and text, and an actor cannot write in another workspace', async () => {
    const s = fresh();
    await expect(s.governance.createCommunication({ workspaceId: PW, title: ' ', body: 'b' }, clerk)).rejects.toThrow(/needs a title/);
    await expect(s.governance.createCommunication({ workspaceId: PW, title: 't', body: ' ' }, clerk)).rejects.toThrow(/needs some text/);
    await expect(s.governance.createCommunication({ workspaceId: PW, title: 't', body: 'x'.repeat(1001) }, clerk)).rejects.toThrow(/1000/);
    await expect(s.governance.createCommunication({ workspaceId: PW, title: 't', body: 'b' }, parksHead)).rejects.toThrow(/Not allowed/);
  });
});

describe('the audit record', () => {
  it('is append-only: sequence numbers rise by one and earlier entries never change', async () => {
    const store = createGovStore();
    const s = createMockServices({ governanceStore: store } as MockOptions);
    const snapshot = JSON.stringify(store.audit);
    await s.governance.createCase({ title: 'One', summary: '', source: 'office', priority: 'routine' }, clerk);
    // A refused route still writes a refusal entry, so the earlier entries are untouched.
    await expect(s.governance.routeCase('case-1001', PARKS, clerk)).rejects.toThrow();
    expect(JSON.stringify(store.audit.slice(0, JSON.parse(snapshot).length))).toBe(snapshot);
    const seqs = store.audit.map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });

  it('exposes no way to edit or delete an entry', () => {
    const s = fresh();
    // The CSV is built client-side from the entries (auditCsv in src/lib/governance.ts); the port itself
    // only exposes 'audit', never an edit or delete.
    expect(Object.keys(s.governance).filter((k) => /audit/i.test(k))).toEqual(['audit']);
    expect(Object.keys(s.governance).some((k) => /delete|remove|edit|update/i.test(k))).toBe(false);
  });

  it('shows each workspace only what involves it', async () => {
    const s = fresh();
    const mine = await s.governance.audit(PW);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.visibleTo.includes(PW))).toBe(true);
    expect(mine.some((e) => e.targetId === 'case-1004')).toBe(true);
    // Parks is involved in nothing yet, so it sees nothing.
    expect(await s.governance.audit(PARKS)).toHaveLength(0);
  });

  it('records who, which role, what, and the states; a refusal says why', async () => {
    const s = fresh();
    await s.governance.routeCase('case-1001', PW, clerk);
    await expect(s.governance.routeCase('case-1006', PARKS, clerk)).rejects.toThrow(/onboarding/);
    const [refusal, done] = await s.governance.audit(PW);
    expect(refusal).toMatchObject({ outcome: 'denied', action: 'case-routed' });
    expect(refusal!.detail.startsWith('Not allowed: ')).toBe(true);
    expect(done).toMatchObject({
      actorName: 'Demo public works staff', actorRole: 'staff', outcome: 'done', action: 'case-routed',
      fromState: 'received', toState: 'routed',
    });
  });

  it('unknown workspaces, cases and communications reject without writing anything', async () => {
    const s = fresh();
    const before = (await s.governance.audit(PW)).length;
    await expect(s.governance.audit('nope')).rejects.toThrow(/not found/);
    await expect(s.governance.routeCase('nope', PW, clerk)).rejects.toThrow(/not found/);
    await expect(s.governance.communicationStep('nope', 'submit', clerk)).rejects.toThrow(/not found/);
    await expect(s.governance.getCase('nope')).resolves.toBeNull();
    expect((await s.governance.audit(PW)).length).toBe(before);
  });

  it('two stores do not share state', async () => {
    const a = fresh();
    const b = fresh();
    const before = (await b.governance.cases({ officeId: PW })).length;
    await a.governance.createCase({ title: 'A loose bollard', summary: '', source: 'resident-report', priority: 'routine' }, clerk);
    expect((await a.governance.cases({ officeId: PW })).length).toBe(before + 1);
    expect((await b.governance.cases({ officeId: PW })).length).toBe(before);
  });
});

describe('the shared record in the running app', () => {
  it('resetting the running store restores the merged seeds', async () => {
    const seed = createGovStore();
    appGovStore.cases.splice(0, appGovStore.cases.length, ...seed.cases);
    appGovStore.communications.splice(0, appGovStore.communications.length, ...seed.communications);
    appGovStore.audit.splice(0, appGovStore.audit.length, ...seed.audit);
    appGovStore.seq = 0;
    expect((await createMockServices().governance.cases({ officeId: PW })).length).toBe(6);
    expect((await createMockServices().governance.communications(PW)).length).toBe(7);
    expect((await createMockServices().governance.audit(PW)).length).toBe(11);
    expect((await createMockServices().governance.audit(PARKS)).length).toBe(0);
  });

  it('a case is visible to the office that received it and the department it is routed to', async () => {
    const s = fresh();
    const byOffice = await s.governance.cases({ officeId: PW });
    expect(byOffice.some((c: GovCase) => c.id === 'case-1002')).toBe(true);
    const byDept = await s.governance.cases({ departmentId: PW });
    expect(byDept.some((c: GovCase) => c.id === 'case-1002')).toBe(true);
    expect(byDept.some((c: GovCase) => c.id === 'case-1001')).toBe(false);
    expect((await s.governance.cases({ departmentId: PARKS }))).toHaveLength(0);
  });
});
