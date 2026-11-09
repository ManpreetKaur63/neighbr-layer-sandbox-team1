import { describe, expect, it } from 'vitest';
import { PERMISSION_ACTIONS, decide, denialMessage, type ActorContext } from '@/lib/permissions';
import { KIND_CONFIG, ROUTE_KINDS, routeForKind, usesPrograms } from '@/lib/workspace-config';
import { workspaceHref } from '@/lib/workspace';
import { ROUTES } from '@/lib/routes';

const active = (role: ActorContext['role']): ActorContext => ({ role, memberStatus: 'active' });

describe('role and permission states (M06)', () => {
  it('owner can do everything in a verified workspace', () => {
    for (const a of PERMISSION_ACTIONS) expect(decide(a.id, active('owner'), 'verified').allowed, a.id).toBe(true);
  });

  it('staff can view, work and publish but not manage', () => {
    expect(decide('view', active('staff'), 'verified').allowed).toBe(true);
    expect(decide('work', active('staff'), 'verified').allowed).toBe(true);
    expect(decide('publish', active('staff'), 'verified').allowed).toBe(true);
    const manage = decide('manage', active('staff'), 'verified');
    expect(manage.allowed).toBe(false);
    expect(manage.reason).toMatch(/staff role cannot manage/);
  });

  it('member can only view', () => {
    expect(decide('view', active('member'), 'verified').allowed).toBe(true);
    for (const a of ['work', 'publish', 'manage'] as const) {
      expect(decide(a, active('member'), 'verified').allowed, a).toBe(false);
    }
  });

  it('onboarding blocks publishing for everyone, even an owner, but not other work', () => {
    expect(decide('work', active('owner'), 'onboarding').allowed).toBe(true);
    expect(decide('manage', active('owner'), 'onboarding').allowed).toBe(true);
    const publish = decide('publish', active('owner'), 'onboarding');
    expect(publish.allowed).toBe(false);
    expect(publish.reason).toMatch(/verified/);
  });

  it('restricted is read-only for every role, but still viewable', () => {
    expect(decide('view', active('owner'), 'restricted').allowed).toBe(true);
    for (const a of ['work', 'publish', 'manage'] as const) {
      const d = decide(a, active('owner'), 'restricted');
      expect(d.allowed, a).toBe(false);
      expect(d.reason).toMatch(/restricted/);
    }
  });

  it('an invited person has no access at all, whatever the role or state', () => {
    for (const status of ['verified', 'onboarding', 'restricted'] as const) {
      for (const a of PERMISSION_ACTIONS) {
        const d = decide(a.id, { role: 'owner', memberStatus: 'invited' }, status);
        expect(d.allowed, `${status}/${a.id}`).toBe(false);
        expect(d.reason).toMatch(/invitation/);
      }
    }
  });

  it('uses one wording for denials', () => {
    expect(denialMessage({ allowed: false, reason: 'X.' })).toBe('Not allowed: X.');
  });
});

describe('per-kind workspace configuration (M06)', () => {
  it('every kind has a route, tabs that start with the overview, and role labels for all three roles', () => {
    for (const [kind, cfg] of Object.entries(KIND_CONFIG)) {
      expect(cfg.tabs[0]?.id, kind).toBe('overview');
      // M07: no Roles tab on any workspace — roles live in onboarding (src/lib/session.ts).
      expect(cfg.tabs.map((t) => t.id as string).includes('roles'), kind).toBe(false);
      expect(Object.keys(cfg.roleLabels).sort(), kind).toEqual(['member', 'owner', 'staff']);
    }
  });

  it('program kinds have a programs tab; BIA and Business keep listings and offers', () => {
    for (const kind of ['institution', 'organization', 'school', 'government'] as const) {
      expect(usesPrograms(kind), kind).toBe(true);
      expect(KIND_CONFIG[kind].tabs.some((t) => t.id === 'programs'), kind).toBe(true);
      expect(KIND_CONFIG[kind].tabs.some((t) => t.id === 'offers'), kind).toBe(false);
    }
    for (const kind of ['bia', 'business'] as const) {
      expect(usesPrograms(kind), kind).toBe(false);
      expect(KIND_CONFIG[kind].tabs.map((t) => t.id)).toEqual(
        expect.arrayContaining(['listings', 'offers']),
      );
    }
  });

  it('routes institutions and schools to /institution, organizations to /organization', () => {
    expect(routeForKind('institution')).toBe('/institution');
    expect(routeForKind('school')).toBe('/institution');
    expect(routeForKind('organization')).toBe('/organization');
    expect(workspaceHref('school', 'ws-school-elementary')).toBe('/institution?ws=ws-school-elementary');
    expect(workspaceHref('organization', 'ws-org-neighbours')).toBe('/organization?ws=ws-org-neighbours');
    expect(ROUTE_KINDS['/institution']).toEqual(['institution', 'school']);
  });

  it('every configured route is a built route in the inventory', () => {
    for (const cfg of Object.values(KIND_CONFIG)) {
      const route = ROUTES.find((r) => r.path === cfg.route);
      expect(route?.status, cfg.route).toBe('built');
    }
  });

  it('the schools carry a no-student-records safeguard', () => {
    expect(KIND_CONFIG.school.safeguards.join(' ')).toMatch(/No student records/);
  });
});
