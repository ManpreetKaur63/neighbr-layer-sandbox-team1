import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import type { ActorContext } from '@/lib/permissions';

const owner: ActorContext = { role: 'owner', memberStatus: 'active' };
const staff: ActorContext = { role: 'staff', memberStatus: 'active' };
const member: ActorContext = { role: 'member', memberStatus: 'active' };
const invited: ActorContext = { role: 'staff', memberStatus: 'invited' };

describe('M06 tenants: institution, school and community organization', () => {
  it('seeds one institution, two schools and two organizations, each with members, tasks and programs', async () => {
    const s = createMockServices();
    const all = await s.workspaces.workspaces();
    const count = (kind: string) => all.filter((w) => w.kind === kind).length;
    expect(count('institution')).toBe(1);
    expect(count('school')).toBe(2);
    expect(count('organization')).toBe(2);
    for (const w of all.filter((x) => ['institution', 'school', 'organization'].includes(x.kind))) {
      expect((await s.workspaces.members(w.id)).length, w.id).toBeGreaterThan(1);
      expect((await s.workspaces.tasks(w.id)).length, w.id).toBeGreaterThan(0);
      expect((await s.workspaces.programs(w.id)).length, w.id).toBeGreaterThan(0);
    }
  });

  it('shows all three access states across the new tenants', async () => {
    const s = createMockServices();
    const all = await s.workspaces.workspaces();
    const status = (id: string) => all.find((w) => w.id === id)?.status;
    expect(status('ws-inst-library')).toBe('verified');
    expect(status('ws-school-elementary')).toBe('verified');
    expect(status('ws-school-academy')).toBe('restricted');
    expect(status('ws-org-neighbours')).toBe('verified');
    expect(status('ws-org-trail')).toBe('onboarding');
  });

  it('every tenant has an invited member, so the no-access state is always demonstrable', async () => {
    const s = createMockServices();
    for (const id of ['ws-inst-library', 'ws-school-elementary', 'ws-org-neighbours', 'ws-org-trail']) {
      expect((await s.workspaces.members(id)).some((m) => m.status === 'invited'), id).toBe(true);
    }
  });

  it('keeps programs per workspace and links them to existing map objects only', async () => {
    const s = createMockServices();
    const lib = await s.workspaces.programs('ws-inst-library');
    expect(lib.every((p) => p.workspaceId === 'ws-inst-library')).toBe(true);
    for (const w of await s.workspaces.workspaces()) {
      for (const p of await s.workspaces.programs(w.id)) {
        if (p.objectId) expect(await s.objects.get(p.objectId), p.id).not.toBeNull();
      }
    }
    await expect(s.workspaces.programs('nope')).rejects.toThrow(/not found/);
  });
});

describe('programs: draft, publish and the gates (M06)', () => {
  it('creates a draft, validates, and publishes from a verified workspace', async () => {
    const s = createMockServices();
    await expect(
      s.workspaces.createProgram({ workspaceId: 'ws-school-elementary', title: '  ', summary: '' }),
    ).rejects.toThrow(/title/);
    await expect(
      s.workspaces.createProgram({ workspaceId: 'nope', title: 'X', summary: '' }),
    ).rejects.toThrow(/not found/);
    await expect(
      s.workspaces.createProgram({ workspaceId: 'ws-school-elementary', title: 'X', summary: '', objectId: 'nope' }),
    ).rejects.toThrow(/not found/);
    const draft = await s.workspaces.createProgram({
      workspaceId: 'ws-school-elementary', title: 'Science fair', summary: 'Demo', objectId: 'w-market',
    });
    expect(draft.status).toBe('draft');
    expect(draft.objectId).toBe('w-market');
    expect((await s.workspaces.publishProgram(draft.id)).status).toBe('published');
    await expect(s.workspaces.publishProgram(draft.id)).rejects.toThrow(/draft/);
    await expect(s.workspaces.publishProgram('nope')).rejects.toThrow(/not found/);
  });

  it('an onboarding organization can draft but not publish', async () => {
    const s = createMockServices();
    await expect(s.workspaces.publishProgram('p-trl-cleanup')).rejects.toThrow(/verified/);
    const draft = await s.workspaces.createProgram({ workspaceId: 'ws-org-trail', title: 'New draft', summary: '' });
    expect(draft.status).toBe('draft');
  });

  it('keeps programs isolated between factory instances', async () => {
    const a = createMockServices();
    const b = createMockServices();
    await a.workspaces.publishProgram('p-lib-circles');
    expect((await b.workspaces.programs('ws-inst-library')).find((p) => p.id === 'p-lib-circles')?.status).toBe('draft');
  });
});

describe('role enforcement in the port (M06, closes M05-D3 for the mock)', () => {
  it('without an actor the port behaves as in M05', async () => {
    const s = createMockServices();
    expect((await s.workspaces.updateTask('ws-bia-sample', 't-bia-vacancy', 'in-progress')).status).toBe('in-progress');
  });

  it('a member cannot work, publish or manage; staff can work and publish but not manage', async () => {
    const s = createMockServices();
    await expect(s.workspaces.updateTask('ws-inst-library', 't-lib-review', 'in-progress', member)).rejects.toThrow(/Not allowed.*member role cannot work/);
    await expect(s.workspaces.createProgram({ workspaceId: 'ws-inst-library', title: 'X', summary: '' }, member)).rejects.toThrow(/Not allowed/);
    await expect(s.workspaces.publishProgram('p-lib-circles', member)).rejects.toThrow(/Not allowed/);
    await expect(s.workspaces.inviteMember({ workspaceId: 'ws-inst-library', name: 'Demo X', role: 'member' }, member)).rejects.toThrow(/Not allowed/);

    expect((await s.workspaces.updateTask('ws-inst-library', 't-lib-review', 'in-progress', staff)).status).toBe('in-progress');
    expect((await s.workspaces.publishProgram('p-lib-circles', staff)).status).toBe('published');
    await expect(s.workspaces.inviteMember({ workspaceId: 'ws-inst-library', name: 'Demo X', role: 'member' }, staff)).rejects.toThrow(/staff role cannot manage/);
  });

  it('an invited person is rejected for every action', async () => {
    const s = createMockServices();
    await expect(s.workspaces.updateTask('ws-inst-library', 't-lib-review', 'in-progress', invited)).rejects.toThrow(/invitation/);
    await expect(s.workspaces.publishProgram('p-lib-circles', invited)).rejects.toThrow(/invitation/);
  });

  it('a restricted workspace rejects every mutation, with or without an actor, for any role', async () => {
    const s = createMockServices();
    const id = 'ws-school-academy';
    await expect(s.workspaces.updateTask(id, 't-acad-review', 'done')).rejects.toThrow(/restricted/);
    await expect(s.workspaces.updateTask(id, 't-acad-review', 'done', owner)).rejects.toThrow(/restricted/);
    await expect(s.workspaces.createProgram({ workspaceId: id, title: 'X', summary: '' }, owner)).rejects.toThrow(/restricted/);
    await expect(s.workspaces.publishProgram('p-acad-english', owner)).rejects.toThrow(/restricted/);
    await expect(s.workspaces.inviteMember({ workspaceId: id, name: 'Demo X', role: 'staff' }, owner)).rejects.toThrow(/restricted/);
    // Reads still work.
    expect((await s.workspaces.programs(id)).length).toBeGreaterThan(0);
    expect((await s.workspaces.tasks(id)).find((t) => t.id === 't-acad-review')?.status).toBe('in-progress');
  });

  it('an onboarding workspace lets an owner work but not publish', async () => {
    const s = createMockServices();
    expect((await s.workspaces.updateTask('ws-org-trail', 't-trl-profile', 'in-progress', owner)).status).toBe('in-progress');
    await expect(s.workspaces.publishProgram('p-trl-cleanup', owner)).rejects.toThrow(/verified/);
  });

  it('applies the same rules to M05 offers and claims', async () => {
    const s = createMockServices();
    await expect(s.workspaces.claimListing('ws-biz-bakery', 'w-cafe', member)).rejects.toThrow(/Not allowed/);
    expect((await s.workspaces.claimListing('ws-biz-bakery', 'w-cafe', staff)).workspaceId).toBe('ws-biz-bakery');
    await expect(
      s.workspaces.createOffer({ workspaceId: 'ws-biz-bakery', businessId: 'w-bakery', title: 'X', summary: '' }, member),
    ).rejects.toThrow(/Not allowed/);
    const hwDraft = await s.workspaces.createOffer({ workspaceId: 'ws-biz-hardware', businessId: 'w-hardware', title: 'HW', summary: '' }, owner);
    await expect(s.workspaces.publishOffer(hwDraft.id, owner)).rejects.toThrow(/verified/);
  });
});

describe('member management (M06)', () => {
  it('invites a person who has no access until they accept', async () => {
    const s = createMockServices();
    const m = await s.workspaces.inviteMember({ workspaceId: 'ws-org-neighbours', name: '  Demo helper  ', role: 'staff' }, owner);
    expect(m.status).toBe('invited');
    expect(m.name).toBe('Demo helper');
    expect((await s.workspaces.members('ws-org-neighbours')).some((x) => x.id === m.id)).toBe(true);
    const accepted = await s.workspaces.acceptInvite(m.id);
    expect(accepted.status).toBe('active');
    await expect(s.workspaces.acceptInvite(m.id)).rejects.toThrow(/no pending invitation/);
    await expect(s.workspaces.acceptInvite('nope')).rejects.toThrow(/not found/);
  });

  it('validates invitations: name, length, duplicates, unknown workspace', async () => {
    const s = createMockServices();
    await expect(s.workspaces.inviteMember({ workspaceId: 'ws-org-neighbours', name: ' ', role: 'member' }, owner)).rejects.toThrow(/name/);
    await expect(s.workspaces.inviteMember({ workspaceId: 'ws-org-neighbours', name: 'x'.repeat(61), role: 'member' }, owner)).rejects.toThrow(/60/);
    await expect(s.workspaces.inviteMember({ workspaceId: 'ws-org-neighbours', name: 'demo volunteer', role: 'member' }, owner)).rejects.toThrow(/already/);
    await expect(s.workspaces.inviteMember({ workspaceId: 'nope', name: 'Demo Y', role: 'member' }, owner)).rejects.toThrow(/not found/);
  });

  it('changes a role, and never leaves a workspace without an active owner', async () => {
    const s = createMockServices();
    const changed = await s.workspaces.changeMemberRole('m-org-3', 'staff', owner);
    expect(changed.role).toBe('staff');
    await expect(s.workspaces.changeMemberRole('m-org-3', 'staff', owner)).rejects.toThrow(/already/);
    await expect(s.workspaces.changeMemberRole('nope', 'staff', owner)).rejects.toThrow(/not found/);
    // The only active owner cannot be demoted.
    await expect(s.workspaces.changeMemberRole('m-org-1', 'staff', owner)).rejects.toThrow(/at least one active owner/);
    // With a second active owner, the first can step down.
    await s.workspaces.changeMemberRole('m-org-2', 'owner', owner);
    expect((await s.workspaces.changeMemberRole('m-org-1', 'staff', owner)).role).toBe('staff');
  });

  it('keeps member changes isolated between factory instances', async () => {
    const a = createMockServices();
    const b = createMockServices();
    await a.workspaces.changeMemberRole('m-org-3', 'staff', owner);
    expect((await b.workspaces.members('ws-org-neighbours')).find((m) => m.id === 'm-org-3')?.role).toBe('member');
  });
});
