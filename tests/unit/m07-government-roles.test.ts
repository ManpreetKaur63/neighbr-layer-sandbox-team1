import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { createRequestStore } from '@/services/mock/requests';
import { KIND_CONFIG, ROUTE_KINDS, routeForKind, usesPrograms } from '@/lib/workspace-config';
import { workspaceHref, workspaceHrefForObject } from '@/lib/workspace';
import { ROUTES } from '@/lib/routes';
import { onboardingSteps, validateRole } from '@/lib/identity';
import { getOnboardingRole, ONBOARDING_ROLES, resolveActor, roleDef, setOnboardingRole } from '@/lib/session';
import type { HandlerActor } from '@/services/ports';

const staff: HandlerActor = { name: 'Demo public works staff', role: 'staff', memberStatus: 'active' };

function setup() {
  const store = createRequestStore();
  return { store, s: createMockServices({ requestStore: store }) };
}

describe('government department workspace (M07)', () => {
  it('is a configured kind on its own route, with a Requests tab and no Roles tab', () => {
    const cfg = KIND_CONFIG.government;
    expect(cfg.route).toBe('/government');
    expect(routeForKind('government')).toBe('/government');
    expect(ROUTE_KINDS['/government']).toEqual(['government']);
    expect(cfg.tabs.map((t) => t.id)).toEqual(['overview', 'members', 'programs', 'requests', 'events', 'tasks']);
    expect(usesPrograms('government')).toBe(true);
    expect(cfg.roleLabels).toEqual({ owner: 'Department head', staff: 'Department staff', member: 'Partner (view only)' });
  });

  it('no workspace kind has a Roles tab any more — roles live in onboarding', () => {
    for (const [kind, cfg] of Object.entries(KIND_CONFIG)) {
      expect(cfg.tabs.map((t) => t.id as string).includes('roles'), kind).toBe(false);
    }
  });

  it('seeds two department tenants with members, tasks and services', async () => {
    const { s } = setup();
    const all = await s.workspaces.workspaces();
    const gov = all.filter((w) => w.kind === 'government');
    expect(gov.map((w) => w.id).sort()).toEqual(['ws-gov-parks', 'ws-gov-public-works']);
    const works = gov.find((w) => w.id === 'ws-gov-public-works')!;
    expect(works.status).toBe('verified');
    expect(gov.find((w) => w.id === 'ws-gov-parks')!.status).toBe('onboarding');
    const members = await s.workspaces.members('ws-gov-public-works');
    expect(members.map((m) => m.id)).toContain('m-gov-2');
    expect(members.find((m) => m.id === 'm-gov-2')).toMatchObject({ role: 'staff', status: 'active' });
    expect(members.some((m) => m.status === 'invited')).toBe(true);
    expect((await s.workspaces.tasks('ws-gov-public-works')).map((t) => t.id)).toContain('t-gov-pothole');
    expect((await s.workspaces.programs('ws-gov-public-works')).map((p) => p.id)).toContain('p-gov-pothole');
  });

  it('links the ward office on the map to the Public Works workspace (closes M06-D3)', () => {
    expect(workspaceHref('government', 'ws-gov-public-works')).toBe('/government?ws=ws-gov-public-works');
    expect(workspaceHrefForObject({ kind: 'organization', workspaceId: 'ws-gov-public-works' })).toBe(
      '/government?ws=ws-gov-public-works',
    );
    expect(workspaceHrefForObject({ kind: 'organization', workspaceId: 'ws-bia-sample' })).toBe(
      '/bia?ws=ws-bia-sample',
    );
    expect(workspaceHrefForObject({ kind: 'business', workspaceId: 'ws-biz-bakery' })).toBe(
      '/business?ws=ws-biz-bakery',
    );
    expect(workspaceHrefForObject({ kind: 'issue' })).toBeNull();
  });

  it('routes a reported issue to the department the person chose, assigns it to a named staff member, and resolves it', async () => {
    const { s } = setup();
    const issue = await s.social.reportIssue({
      title: 'Pothole on Riverside',
      summary: 'Near the bakery',
      cityId: 'windsor',
      coordinates: [-82.989, 42.3244],
    });
    const r = await s.requests.create({
      kind: 'issue',
      title: issue.title,
      summary: issue.summary,
      cityId: 'windsor',
      objectId: issue.id,
      workspaceId: 'ws-gov-public-works',
    });
    expect(r.workspaceId).toBe('ws-gov-public-works');
    expect((await s.requests.list({ workspaceId: 'ws-gov-public-works' })).map((x) => x.id)).toEqual([r.id]);
    expect(await s.requests.list({ workspaceId: 'ws-bia-sample' })).toEqual([]);
    const assigned = await s.requests.handle(r.id, { action: 'assign', assigneeId: 'm-gov-2' }, staff);
    expect(assigned.status).toBe('in-review');
    expect(assigned.assignee).toEqual({ id: 'm-gov-2', name: 'Demo public works staff' });
    const resolved = await s.requests.handle(r.id, { action: 'resolve', note: 'Pothole filled.' }, staff);
    expect(resolved.status).toBe('resolved');
    expect((await s.objects.get(issue.id))?.status).toBe('Resolved');
  });
});

describe('roles in onboarding (M07)', () => {
  it('offers five roles, each with a plain description and a workspace to open', () => {
    expect(ONBOARDING_ROLES.map((r) => r.id)).toEqual([
      'resident',
      'business-owner',
      'bia-coordinator',
      'org-member',
      'city-staff',
    ]);
    for (const r of ONBOARDING_ROLES) {
      expect(r.label.length, r.id).toBeGreaterThan(0);
      expect(r.description.length, r.id).toBeGreaterThan(0);
      expect(r.workspaceHref.startsWith('/'), r.id).toBe(true);
    }
    expect(roleDef('city-staff').workspaceHref).toBe('/government');
    expect(roleDef('bia-coordinator').workspaceHref).toBe('/bia');
  });

  it('defaults to resident, keeps the chosen role for the session, and falls back on junk', () => {
    window.sessionStorage.clear();
    expect(getOnboardingRole()).toBe('resident');
    setOnboardingRole('city-staff');
    expect(getOnboardingRole()).toBe('city-staff');
    window.sessionStorage.setItem('neighbr-demo-role-v1', 'not-a-role');
    expect(getOnboardingRole()).toBe('resident');
    window.sessionStorage.clear();
  });

  it('resolves a role to a member of the workspace, or to nobody (least privilege)', async () => {
    const { s } = setup();
    const govMembers = await s.workspaces.members('ws-gov-public-works');
    expect(resolveActor('city-staff', govMembers)?.id).toBe('m-gov-2');
    expect(resolveActor('resident', govMembers)).toBeNull();
    // A BIA coordinator is not a member of the department: no access by accident.
    expect(resolveActor('bia-coordinator', govMembers)).toBeNull();
    const biaMembers = await s.workspaces.members('ws-bia-sample');
    expect(resolveActor('bia-coordinator', biaMembers)?.id).toBe('m-bia-2');
  });

  it('requires a role before the review step, and both onboarding journeys name the role step', () => {
    expect(validateRole(null)).toMatch(/Choose a role/);
    expect(validateRole('city-staff')).toBeNull();
    expect(onboardingSteps('individual')).toContain('Choose your role in Neighbr');
    expect(onboardingSteps('organization')).toContain('Choose your role in Neighbr');
  });
});

describe('route inventory (M07)', () => {
  it('adds /government as built and /representative as a profile page: 34 routes', () => {
    expect(ROUTES).toHaveLength(34);
    expect(ROUTES.find((r) => r.path === '/government')).toMatchObject({ status: 'built', milestone: 'M07' });
    expect(ROUTES.find((r) => r.path === '/representative')).toMatchObject({ status: 'partial', milestone: 'M07' });
    expect(ROUTES.filter((r) => r.status === 'built')).toHaveLength(20);
  });
});
