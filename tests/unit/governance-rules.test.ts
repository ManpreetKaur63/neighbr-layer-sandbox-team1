import { describe, expect, it } from 'vitest';
import {
  APPROVER_ROLE,
  auditCsv,
  canReceiveCases,
  decideApproval,
  decideCaseStep,
  decideCommStep,
  isPublic,
  type GovActor,
} from '@/lib/governance';
import type { Communication, GovCase, Workspace } from '@/lib/schemas';

/* Merged tree: there is no 'office' or 'department' kind. The office role and the department role are both
 * played by 'government' workspaces (Public Works); a 'business' workspace is the non-department here. */
const ws = (over: Partial<Workspace>): Workspace => ({
  id: 'ws-x', kind: 'government', name: 'Sample government workspace', cityId: 'windsor', status: 'verified', summary: 's', synthetic: true, ...over,
});
const office = ws({ id: 'ws-office' });
const dept = ws({ id: 'ws-dept', name: 'Sample dept' });
const biz = ws({ id: 'ws-biz', kind: 'business', name: 'Sample business' });

const actor = (over: Partial<GovActor>): GovActor => ({
  id: 'm1', name: 'Demo', workspaceId: 'ws-office', role: 'staff', memberStatus: 'active', ...over,
});

const aCase = (over: Partial<GovCase> = {}): GovCase => ({
  id: 'c1', reference: 'CASE-1001', title: 't', summary: '', cityId: 'windsor', source: 'inquiry', priority: 'routine',
  status: 'received', officeId: 'ws-office', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', synthetic: true, ...over,
});

const aComm = (over: Partial<Communication> = {}): Communication => ({
  id: 'm1c', workspaceId: 'ws-office', kind: 'notice', title: 't', body: 'b', state: 'in-review', authorId: 'author', authorName: 'Author',
  updatedAt: '2026-11-01T00:00:00.000Z', synthetic: true, ...over,
});

describe('canReceiveCases (M07)', () => {
  it('accepts a verified department in the same city', () => {
    expect(canReceiveCases(dept, office).allowed).toBe(true);
  });
  it('refuses restricted and onboarding departments, another city, and a non-department', () => {
    expect(canReceiveCases(ws({ ...dept, status: 'restricted' }), office)).toMatchObject({ allowed: false });
    expect(canReceiveCases(ws({ ...dept, status: 'onboarding' }), office).reason).toMatch(/onboarding/);
    expect(canReceiveCases(ws({ ...dept, cityId: 'toronto' }), office).reason).toMatch(/another city/);
    expect(canReceiveCases(biz, office).reason).toMatch(/not a department/);
  });
});

describe('decideCaseStep (M07)', () => {
  it('lets the office route a received or returned case, and nothing else', () => {
    expect(decideCaseStep('route', actor({}), aCase(), office).allowed).toBe(true);
    expect(decideCaseStep('route', actor({}), aCase({ status: 'returned' }), office).allowed).toBe(true);
    expect(decideCaseStep('route', actor({}), aCase({ status: 'routed' }), office).reason).toMatch(/cannot take this step/);
  });
  it('lets only the routed department accept, return or close', () => {
    const c = aCase({ status: 'routed', departmentId: 'ws-dept' });
    const d = actor({ workspaceId: 'ws-dept' });
    expect(decideCaseStep('accept', d, c, dept).allowed).toBe(true);
    expect(decideCaseStep('return', d, c, dept).allowed).toBe(true);
    expect(decideCaseStep('close', d, c, dept).allowed).toBe(false); // not accepted yet
    expect(decideCaseStep('accept', actor({ workspaceId: 'ws-other' }), c, dept).reason).toMatch(/department the case is routed to/);
    // The office cannot take the department's step.
    expect(decideCaseStep('accept', actor({}), c, office).allowed).toBe(false);
  });
  it('respects role and workspace state through the shared rule', () => {
    expect(decideCaseStep('route', actor({ role: 'member' }), aCase(), office).allowed).toBe(false);
    expect(decideCaseStep('route', actor({ memberStatus: 'invited' }), aCase(), office).reason).toMatch(/invitation/);
    expect(decideCaseStep('route', actor({}), aCase(), ws({ ...office, status: 'restricted' })).reason).toMatch(/restricted/);
  });
  it('lets the office close an unrouted case but not a routed one', () => {
    expect(decideCaseStep('close', actor({}), aCase(), office).allowed).toBe(true);
    expect(decideCaseStep('close', actor({}), aCase({ status: 'in-progress', departmentId: 'ws-dept' }), office).allowed).toBe(false);
  });
});

describe('decideApproval: the four-eyes rule (M07)', () => {
  const owner = actor({ id: 'boss', role: 'owner' });
  it('lets an owner who did not write it approve', () => {
    expect(decideApproval(owner, aComm(), office)).toMatchObject({ allowed: true, kind: 'ok' });
  });
  it('refuses the author, even an owner, with a distinct kind the screen can explain', () => {
    const d = decideApproval(actor({ id: 'author', role: 'owner' }), aComm(), office);
    expect(d).toMatchObject({ allowed: false, kind: 'author' });
    expect(d.reason).toMatch(/Four-eyes/);
  });
  it('refuses staff and members: approval needs the owner role', () => {
    expect(APPROVER_ROLE).toBe('owner');
    expect(decideApproval(actor({ role: 'staff' }), aComm(), office).kind).toBe('role');
    expect(decideApproval(actor({ role: 'member' }), aComm(), office).allowed).toBe(false);
  });
  it('refuses an unverified or restricted workspace and an item that is not in review', () => {
    expect(decideApproval(owner, aComm(), ws({ ...office, status: 'onboarding' })).reason).toMatch(/verified/);
    expect(decideApproval(owner, aComm(), ws({ ...office, status: 'restricted' })).allowed).toBe(false);
    expect(decideApproval(owner, aComm({ state: 'draft' }), office).kind).toBe('state');
  });
  it('refuses someone acting in another workspace', () => {
    expect(decideApproval(actor({ role: 'owner', workspaceId: 'ws-dept' }), aComm(), office).allowed).toBe(false);
  });
});

describe('decideCommStep (M07)', () => {
  it('staff can submit a draft or returned item but not return or withdraw', () => {
    expect(decideCommStep('submit', actor({}), aComm({ state: 'draft' }), office).allowed).toBe(true);
    expect(decideCommStep('submit', actor({}), aComm({ state: 'returned' }), office).allowed).toBe(true);
    expect(decideCommStep('submit', actor({}), aComm({ state: 'published' }), office).allowed).toBe(false);
    expect(decideCommStep('return', actor({}), aComm(), office).reason).toMatch(/owner role/);
    expect(decideCommStep('withdraw', actor({}), aComm({ state: 'published' }), office).allowed).toBe(false);
  });
  it('the owner can return an item in review and withdraw a published one', () => {
    const owner = actor({ role: 'owner' });
    expect(decideCommStep('return', owner, aComm(), office).allowed).toBe(true);
    expect(decideCommStep('withdraw', owner, aComm({ state: 'published' }), office).allowed).toBe(true);
    expect(decideCommStep('withdraw', owner, aComm({ state: 'draft' }), office).allowed).toBe(false);
  });
});

describe('isPublic and auditCsv (M07)', () => {
  it('only a published item is public', () => {
    for (const s of ['draft', 'in-review', 'returned', 'withdrawn'] as const) expect(isPublic(aComm({ state: s }))).toBe(false);
    expect(isPublic(aComm({ state: 'published' }))).toBe(true);
  });
  it('writes a CSV with quoted, escaped cells', () => {
    const csv = auditCsv([{ seq: 1, at: 'x', actorName: 'A "B"', actorRole: 'staff', action: 'a', targetLabel: 't', outcome: 'done', detail: 'one, two' }]);
    expect(csv.split('\n')[0]).toBe('seq,at,actor,role,action,target,outcome,detail');
    expect(csv).toContain('"A ""B"""');
    expect(csv).toContain('"one, two"');
  });
});
