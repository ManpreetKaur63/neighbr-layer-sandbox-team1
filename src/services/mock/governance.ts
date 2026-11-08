import {
  auditEntrySchema,
  communicationSchema,
  govCaseSchema,
  type AuditAction,
  type AuditEntry,
  type Communication,
  type GovCase,
  type Workspace,
} from '@/lib/schemas';
import { decide, denialMessage } from '@/lib/permissions';
import {
  CASE_NOTE_REQUIRED,
  COMM_NOTE_REQUIRED,
  canReceiveCases,
  decideApproval,
  decideCaseStep,
  decideCommStep,
  type GovActor,
} from '@/lib/governance';
import type { GovernancePort } from '../ports';

/**
 * M07 governed response state: cases, communications and the audit record. Pages in this shell each build their
 * own mock services, and a case routed on the office page must be there on the department page, so the state
 * lives in a store the services share and keep in the browser session (like the M06 request store). A full
 * reload in a new tab starts from the seed. Tests pass a fresh store so nothing leaks between them.
 */
export interface GovStore {
  /** Called after any change; the running app uses it to save the store in the browser session. */
  onChange?: () => void;
  cases: GovCase[];
  communications: Communication[];
  audit: AuditEntry[];
  seq: number;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const nowIso = () => new Date().toISOString();

/* ---------- seed ---------- */

const OFFICE = 'ws-ward-sample';

const SEED_CASES: GovCase[] = [
  {
    id: 'case-1001', reference: 'CASE-1001', title: 'Sidewalk repair requested near the market',
    summary: 'A resident reports a lifted slab near the harvest market entrance (demo).', cityId: 'windsor',
    source: 'resident-report', priority: 'routine', status: 'received', officeId: OFFICE, objectId: 'w-sidewalk',
    createdAt: '2026-11-05T14:10:00.000Z', updatedAt: '2026-11-05T14:10:00.000Z', synthetic: true,
  },
  {
    id: 'case-1002', reference: 'CASE-1002', title: 'Roadworks blocking shop access',
    summary: 'Shops on the corridor say delivery vans cannot reach their back doors (demo).', cityId: 'windsor',
    source: 'resident-report', priority: 'urgent', status: 'routed', officeId: OFFICE, departmentId: 'ws-dept-works',
    objectId: 'w-roadworks', createdAt: '2026-11-04T09:30:00.000Z', updatedAt: '2026-11-04T10:05:00.000Z', synthetic: true,
  },
  {
    id: 'case-1003', reference: 'CASE-1003', title: 'Trail lookout bench replacement',
    summary: 'The bench at the riverfront lookout is broken and has been taped off (demo).', cityId: 'windsor',
    source: 'inquiry', priority: 'routine', status: 'in-progress', officeId: OFFICE, departmentId: 'ws-dept-parks',
    objectId: 'w-trail', assignee: { id: 'm-parks-2', name: 'Demo parks supervisor' },
    createdAt: '2026-11-03T11:00:00.000Z', updatedAt: '2026-11-05T08:45:00.000Z', synthetic: true,
  },
  {
    id: 'case-1004', reference: 'CASE-1004', title: 'Streetlight out on sample block',
    summary: 'A streetlight has been out for a week (demo).', cityId: 'windsor',
    source: 'resident-report', priority: 'routine', status: 'closed', officeId: OFFICE, departmentId: 'ws-dept-works',
    objectId: 'w-streetlight', assignee: { id: 'm-works-2', name: 'Demo works supervisor' },
    createdAt: '2026-10-29T16:20:00.000Z', updatedAt: '2026-11-03T15:00:00.000Z', synthetic: true,
  },
  {
    id: 'case-1005', reference: 'CASE-1005', title: 'Question about backyard fire rules',
    summary: 'A resident asks whether a backyard fire pit is allowed on a small lot (demo).', cityId: 'windsor',
    source: 'inquiry', priority: 'routine', status: 'returned', officeId: OFFICE,
    createdAt: '2026-11-02T13:15:00.000Z', updatedAt: '2026-11-04T12:00:00.000Z', synthetic: true,
  },
  {
    id: 'case-1006', reference: 'CASE-1006', title: 'Flooded underpass after heavy rain',
    summary: 'The office noticed standing water under the rail bridge on the commuter route (demo).', cityId: 'windsor',
    source: 'office', priority: 'urgent', status: 'received', officeId: OFFICE,
    createdAt: '2026-11-06T07:50:00.000Z', updatedAt: '2026-11-06T07:50:00.000Z', synthetic: true,
  },
];

const SEED_COMMS: Communication[] = [
  {
    id: 'comm-1', workspaceId: OFFICE, kind: 'notice', title: 'Ward community meeting, 19 November',
    body: 'The ward office is holding an open community meeting at the library on 19 November. Everyone is welcome (demo notice).',
    state: 'published', authorId: 'm-ward-3', authorName: 'Demo communications officer',
    reviewerName: 'Demo chief of staff', updatedAt: '2026-11-03T10:30:00.000Z', publishedAt: '2026-11-03T10:30:00.000Z', synthetic: true,
  },
  {
    id: 'comm-2', workspaceId: OFFICE, kind: 'notice', title: 'Riverside Drive lane closure this week',
    body: 'One lane of Riverside Drive is closed from Tuesday to Friday for pavement work. Allow extra time (demo notice).',
    state: 'in-review', authorId: 'm-ward-3', authorName: 'Demo communications officer',
    updatedAt: '2026-11-06T09:00:00.000Z', synthetic: true,
  },
  {
    id: 'comm-3', workspaceId: OFFICE, kind: 'notice', title: 'Winter parking reminder',
    body: 'Overnight street parking rules change on 1 December (demo draft).',
    state: 'draft', authorId: 'm-ward-3', authorName: 'Demo communications officer',
    updatedAt: '2026-11-06T11:15:00.000Z', synthetic: true,
  },
  {
    id: 'comm-4', workspaceId: OFFICE, kind: 'notice', title: 'Holiday office hours',
    body: 'The ward office will have reduced hours over the holidays (demo draft).',
    state: 'returned', authorId: 'm-ward-2', authorName: 'Demo constituent services officer',
    reviewerName: 'Demo chief of staff', reviewNote: 'Add the exact dates for the week of 28 December.',
    updatedAt: '2026-11-05T16:40:00.000Z', synthetic: true,
  },
  {
    id: 'comm-5', workspaceId: 'ws-dept-works', kind: 'response', caseId: 'case-1004', title: 'Streetlight repaired on the sample block',
    body: 'The streetlight reported on the sample block was repaired on 3 November. Thank you for reporting it (demo response).',
    state: 'published', authorId: 'm-works-2', authorName: 'Demo works supervisor',
    reviewerName: 'Demo works manager', updatedAt: '2026-11-03T15:00:00.000Z', publishedAt: '2026-11-03T15:00:00.000Z', synthetic: true,
  },
  {
    id: 'comm-6', workspaceId: 'ws-dept-works', kind: 'response', caseId: 'case-1002', title: 'Roadworks: access for deliveries',
    body: 'Crews are marking a loading zone behind the corridor shops while the work continues (demo draft).',
    state: 'draft', authorId: 'm-works-3', authorName: 'Demo works dispatcher',
    updatedAt: '2026-11-05T09:20:00.000Z', synthetic: true,
  },
  {
    id: 'comm-7', workspaceId: 'ws-dept-works', kind: 'notice', title: 'Detour map for the corridor (replaced)',
    body: 'An earlier detour map was replaced after the route changed (demo).',
    state: 'withdrawn', authorId: 'm-works-3', authorName: 'Demo works dispatcher',
    reviewerName: 'Demo works manager', reviewNote: 'The route changed on 2 November; a new map will follow.',
    updatedAt: '2026-11-02T17:00:00.000Z', publishedAt: '2026-10-30T12:00:00.000Z', synthetic: true,
  },
];

type SeedAudit = Omit<AuditEntry, 'seq' | 'synthetic' | 'id'>;
const A = (e: SeedAudit): SeedAudit => e;

const SEED_AUDIT: SeedAudit[] = [
  A({ at: '2026-10-29T16:20:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE], actorId: 'm-ward-2', actorName: 'Demo constituent services officer', actorRole: 'staff', action: 'case-created', targetType: 'case', targetId: 'case-1004', targetLabel: 'CASE-1004', outcome: 'done', detail: 'Case logged from a resident report.', toState: 'received' }),
  A({ at: '2026-10-29T16:45:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE, 'ws-dept-works'], actorId: 'm-ward-2', actorName: 'Demo constituent services officer', actorRole: 'staff', action: 'case-routed', targetType: 'case', targetId: 'case-1004', targetLabel: 'CASE-1004', outcome: 'done', detail: 'Routed to Sample Public Works Department.', fromState: 'received', toState: 'routed' }),
  A({ at: '2026-10-30T08:10:00.000Z', workspaceId: 'ws-dept-works', visibleTo: [OFFICE, 'ws-dept-works'], actorId: 'm-works-2', actorName: 'Demo works supervisor', actorRole: 'staff', action: 'case-accepted', targetType: 'case', targetId: 'case-1004', targetLabel: 'CASE-1004', outcome: 'done', detail: 'Accepted by Demo works supervisor.', fromState: 'routed', toState: 'in-progress' }),
  A({ at: '2026-11-03T10:00:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE], actorId: 'm-ward-3', actorName: 'Demo communications officer', actorRole: 'staff', action: 'comm-approved', targetType: 'communication', targetId: 'comm-1', targetLabel: 'Ward community meeting, 19 November', outcome: 'denied', detail: 'Not allowed: Only the office lead or department manager (the owner role) can approve publication.', fromState: 'in-review' }),
  A({ at: '2026-11-03T10:30:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE], actorId: 'm-ward-1', actorName: 'Demo chief of staff', actorRole: 'owner', action: 'comm-approved', targetType: 'communication', targetId: 'comm-1', targetLabel: 'Ward community meeting, 19 November', outcome: 'done', detail: 'Approved and published. Written by Demo communications officer.', fromState: 'in-review', toState: 'published' }),
  A({ at: '2026-11-03T15:00:00.000Z', workspaceId: 'ws-dept-works', visibleTo: [OFFICE, 'ws-dept-works'], actorId: 'm-works-1', actorName: 'Demo works manager', actorRole: 'owner', action: 'comm-approved', targetType: 'communication', targetId: 'comm-5', targetLabel: 'Streetlight repaired on the sample block', outcome: 'done', detail: 'Approved and published. Written by Demo works supervisor.', fromState: 'in-review', toState: 'published' }),
  A({ at: '2026-11-03T15:05:00.000Z', workspaceId: 'ws-dept-works', visibleTo: [OFFICE, 'ws-dept-works'], actorId: 'm-works-2', actorName: 'Demo works supervisor', actorRole: 'staff', action: 'case-closed', targetType: 'case', targetId: 'case-1004', targetLabel: 'CASE-1004', outcome: 'done', detail: 'Closed: light replaced and tested.', fromState: 'in-progress', toState: 'closed' }),
  A({ at: '2026-11-04T10:05:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE, 'ws-dept-works'], actorId: 'm-ward-2', actorName: 'Demo constituent services officer', actorRole: 'staff', action: 'case-routed', targetType: 'case', targetId: 'case-1002', targetLabel: 'CASE-1002', outcome: 'done', detail: 'Routed to Sample Public Works Department.', fromState: 'received', toState: 'routed' }),
  A({ at: '2026-11-04T12:00:00.000Z', workspaceId: 'ws-dept-parks', visibleTo: [OFFICE, 'ws-dept-parks'], actorId: 'm-parks-2', actorName: 'Demo parks supervisor', actorRole: 'staff', action: 'case-returned', targetType: 'case', targetId: 'case-1005', targetLabel: 'CASE-1005', outcome: 'done', detail: 'Returned: this is a bylaw question, not a parks matter.', fromState: 'routed', toState: 'returned' }),
  A({ at: '2026-11-05T16:40:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE], actorId: 'm-ward-1', actorName: 'Demo chief of staff', actorRole: 'owner', action: 'comm-returned', targetType: 'communication', targetId: 'comm-4', targetLabel: 'Holiday office hours', outcome: 'done', detail: 'Returned for changes: Add the exact dates for the week of 28 December.', fromState: 'in-review', toState: 'returned' }),
  A({ at: '2026-11-06T09:00:00.000Z', workspaceId: OFFICE, visibleTo: [OFFICE], actorId: 'm-ward-3', actorName: 'Demo communications officer', actorRole: 'staff', action: 'comm-submitted', targetType: 'communication', targetId: 'comm-2', targetLabel: 'Riverside Drive lane closure this week', outcome: 'done', detail: 'Submitted for review.', fromState: 'draft', toState: 'in-review' }),
];

export function createGovStore(): GovStore {
  return {
    cases: clone(SEED_CASES),
    communications: clone(SEED_COMMS),
    audit: SEED_AUDIT.map((e, i) =>
      auditEntrySchema.parse({ ...e, id: `au-seed-${i + 1}`, seq: i + 1, synthetic: true }),
    ),
    seq: 0,
  };
}

/* ---------- browser session persistence (guarded, like the request store) ---------- */

const STORAGE_KEY = 'neighbr-demo-gov-store-v1';

function loadFromSession(store: GovStore): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { cases?: unknown[]; communications?: unknown[]; audit?: unknown[]; seq?: unknown };
    const cases = (data.cases ?? []).map((c) => govCaseSchema.safeParse(c));
    const comms = (data.communications ?? []).map((c) => communicationSchema.safeParse(c));
    const audit = (data.audit ?? []).map((a) => auditEntrySchema.safeParse(a));
    // Only trust a saved state that is complete. A partial state would break the record.
    if ([...cases, ...comms, ...audit].some((r) => !r.success) || audit.length === 0) return;
    store.cases = cases.flatMap((r) => (r.success ? [r.data] : []));
    store.communications = comms.flatMap((r) => (r.success ? [r.data] : []));
    store.audit = audit.flatMap((r) => (r.success ? [r.data] : []));
    if (typeof data.seq === 'number') store.seq = data.seq;
  } catch {
    /* unreadable saved state: keep the seed */
  }
}

function saveToSession(store: GovStore): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cases: store.cases, communications: store.communications, audit: store.audit, seq: store.seq }),
    );
  } catch {
    /* storage full or blocked: the demo still works inside this page load */
  }
}

/** The store the running app shares between pages (and keeps for the browser session). */
export const appGovStore: GovStore = createGovStore();
loadFromSession(appGovStore);
appGovStore.onChange = () => saveToSession(appGovStore);

/* ---------- port ---------- */

interface RecordEntry {
  action: AuditAction;
  targetType: AuditEntry['targetType'];
  targetId: string;
  targetLabel: string;
  outcome: AuditEntry['outcome'];
  detail: string;
  fromState?: string;
  toState?: string;
  alsoVisibleTo?: (string | undefined)[];
}

export interface GovDeps {
  store: GovStore;
  workspaces: Workspace[];
  wait: () => Promise<void>;
}

export function createGovernancePort(deps: GovDeps): GovernancePort {
  const { store, workspaces, wait } = deps;

  const workspaceOrThrow = (id: string): Workspace => {
    const found = workspaces.find((w) => w.id === id);
    if (!found) throw new Error(`Workspace "${id}" not found.`);
    return found;
  };
  const caseOrThrow = (id: string): GovCase => {
    const found = store.cases.find((c) => c.id === id);
    if (!found) throw new Error(`Case "${id}" not found.`);
    return found;
  };
  const commOrThrow = (id: string): Communication => {
    const found = store.communications.find((c) => c.id === id);
    if (!found) throw new Error(`Communication "${id}" not found.`);
    return found;
  };

  /** Append one entry. This is the only place an entry is created; nothing edits or removes one. */
  function record(actor: GovActor, entry: RecordEntry): void {
    const { alsoVisibleTo = [], ...rest } = entry;
    const visibleTo = [...new Set([actor.workspaceId, ...alsoVisibleTo.filter((x): x is string => !!x)])];
    const seq = (store.audit[store.audit.length - 1]?.seq ?? 0) + 1;
    store.audit.push(
      auditEntrySchema.parse({
        ...rest,
        id: `au-${seq}`,
        seq,
        at: nowIso(),
        workspaceId: actor.workspaceId,
        visibleTo,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        synthetic: true,
      }),
    );
  }

  /** Record a refused attempt, then refuse. */
  function refuse(actor: GovActor, reason: string, entry: RecordEntry extends infer E ? Omit<E, 'outcome' | 'detail'> : never): never {
    const message = denialMessage({ allowed: false, reason });
    record(actor, { ...entry, outcome: 'denied', detail: message });
    throw new Error(message);
  }

  const caseVisible = (c: GovCase) => [c.officeId, c.departmentId];
  const nextReference = () => {
    const max = store.cases.reduce((m, c) => Math.max(m, Number(c.reference.slice(5))), 1000);
    return `CASE-${max + 1}`;
  };
  const nextId = (prefix: string) => `${prefix}-local-${(store.seq += 1)}`;

  const port: GovernancePort = {
    async cases(filter) {
      await wait();
      const all =
        'officeId' in filter
          ? store.cases.filter((c) => c.officeId === filter.officeId)
          : store.cases.filter((c) => c.departmentId === filter.departmentId);
      return clone([...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    async getCase(id) {
      await wait();
      const found = store.cases.find((c) => c.id === id);
      return found ? clone(found) : null;
    },
    async createCase(input, actor) {
      await wait();
      const ws = workspaceOrThrow(actor.workspaceId);
      const base = { action: 'case-created' as const, targetType: 'case' as const, targetId: 'new', targetLabel: input.title.trim() || 'New case' };
      if (ws.kind !== 'office') refuse(actor, 'Only a public office logs cases. A department receives them by routing.', base);
      const d = decide('work', actor, ws.status);
      if (!d.allowed) refuse(actor, d.reason, base);
      const title = input.title.trim();
      if (!title) throw new Error('A case needs a title.');
      if (title.length > 120) throw new Error('A title can be at most 120 characters.');
      if (input.objectId === '') delete input.objectId;
      const at = nowIso();
      const c = govCaseSchema.parse({
        id: nextId('case'),
        reference: nextReference(),
        title,
        summary: input.summary.trim().slice(0, 500),
        cityId: ws.cityId,
        source: input.source,
        priority: input.priority,
        status: 'received',
        officeId: ws.id,
        ...(input.objectId ? { objectId: input.objectId } : {}),
        createdAt: at,
        updatedAt: at,
        synthetic: true,
      });
      store.cases.push(c);
      record(actor, {
        action: 'case-created', targetType: 'case', targetId: c.id, targetLabel: c.reference,
        outcome: 'done', detail: `Case logged (${c.source}, ${c.priority}).`, toState: 'received',
      });
      return clone(c);
    },
    async routeCase(caseId, departmentId, actor, note) {
      await wait();
      const c = caseOrThrow(caseId);
      const ws = workspaceOrThrow(actor.workspaceId);
      const base = { action: 'case-routed' as const, targetType: 'case' as const, targetId: c.id, targetLabel: c.reference, fromState: c.status, alsoVisibleTo: caseVisible(c) };
      const step = decideCaseStep('route', actor, c, ws);
      if (!step.allowed) refuse(actor, step.reason, base);
      const dept = workspaces.find((w) => w.id === departmentId);
      if (!dept) throw new Error(`Department "${departmentId}" not found.`);
      const can = canReceiveCases(dept, ws);
      if (!can.allowed) refuse(actor, can.reason, { ...base, alsoVisibleTo: [...caseVisible(c), dept.id] });
      c.status = 'routed';
      c.departmentId = dept.id;
      delete c.assignee;
      c.updatedAt = nowIso();
      const extra = note?.trim() ? ` Note: ${note.trim()}` : '';
      record(actor, {
        action: 'case-routed', targetType: 'case', targetId: c.id, targetLabel: c.reference, outcome: 'done',
        detail: `Routed to ${dept.name}.${extra}`, fromState: base.fromState, toState: 'routed', alsoVisibleTo: [...caseVisible(c), dept.id],
      });
      return clone(c);
    },
    async caseStep(caseId, step, actor, note) {
      await wait();
      const c = caseOrThrow(caseId);
      const ws = workspaceOrThrow(actor.workspaceId);
      const action: AuditAction = step === 'accept' ? 'case-accepted' : step === 'return' ? 'case-returned' : 'case-closed';
      const base = { action, targetType: 'case' as const, targetId: c.id, targetLabel: c.reference, fromState: c.status, alsoVisibleTo: caseVisible(c) };
      const d = decideCaseStep(step, actor, c, ws);
      if (!d.allowed) refuse(actor, d.reason, base);
      const clean = note?.trim() ?? '';
      const needed = CASE_NOTE_REQUIRED[step];
      if (needed && !clean) throw new Error(needed);
      if (step === 'close' && store.communications.some((m) => m.caseId === c.id && m.state === 'in-review')) {
        refuse(actor, 'A public response to this case is still in review. Finish the review before closing.', base);
      }
      const from = c.status;
      const departmentId = c.departmentId;
      if (step === 'accept') {
        c.status = 'in-progress';
        c.assignee = { id: actor.id, name: actor.name };
      } else if (step === 'return') {
        c.status = 'returned';
        delete c.departmentId;
        delete c.assignee;
      } else {
        c.status = 'closed';
      }
      c.updatedAt = nowIso();
      const detail =
        step === 'accept' ? `Accepted by ${actor.name}.` : step === 'return' ? `Returned: ${clean}` : `Closed: ${clean}`;
      record(actor, {
        action, targetType: 'case', targetId: c.id, targetLabel: c.reference, outcome: 'done', detail,
        fromState: from, toState: c.status, alsoVisibleTo: [c.officeId, departmentId],
      });
      return clone(c);
    },

    async communications(workspaceId) {
      await wait();
      workspaceOrThrow(workspaceId);
      return clone(
        store.communications.filter((m) => m.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
    async publicFeed(officeId) {
      await wait();
      workspaceOrThrow(officeId);
      const mine = new Set(store.cases.filter((c) => c.officeId === officeId).map((c) => c.id));
      return clone(
        store.communications
          .filter((m) => m.state === 'published' && (m.workspaceId === officeId || (m.caseId !== undefined && mine.has(m.caseId))))
          .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
      );
    },
    async createCommunication(input, actor) {
      await wait();
      const ws = workspaceOrThrow(input.workspaceId);
      const base = { action: 'comm-created' as const, targetType: 'communication' as const, targetId: 'new', targetLabel: input.title.trim() || 'New communication' };
      if (actor.workspaceId !== ws.id) refuse(actor, 'You can only write in the workspace you are acting in.', base);
      if (ws.kind !== 'office' && ws.kind !== 'department') refuse(actor, 'Only an office or a department writes public communications here.', base);
      const d = decide('work', actor, ws.status);
      if (!d.allowed) refuse(actor, d.reason, base);
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title) throw new Error('A communication needs a title.');
      if (title.length > 120) throw new Error('A title can be at most 120 characters.');
      if (!body) throw new Error('A communication needs some text.');
      if (body.length > 1000) throw new Error('The text can be at most 1000 characters.');
      let linked: GovCase | undefined;
      if (input.caseId) {
        linked = store.cases.find((c) => c.id === input.caseId);
        if (!linked) throw new Error(`Case "${input.caseId}" not found.`);
        if (linked.officeId !== ws.id && linked.departmentId !== ws.id) {
          refuse(actor, 'This workspace is not handling that case, so it cannot write a response to it.', { ...base, alsoVisibleTo: caseVisible(linked) });
        }
      }
      const m = communicationSchema.parse({
        id: nextId('comm'),
        workspaceId: ws.id,
        kind: linked ? 'response' : 'notice',
        title,
        body,
        ...(linked ? { caseId: linked.id } : {}),
        state: 'draft',
        authorId: actor.id,
        authorName: actor.name,
        updatedAt: nowIso(),
        synthetic: true,
      });
      store.communications.push(m);
      record(actor, {
        action: 'comm-created', targetType: 'communication', targetId: m.id, targetLabel: m.title, outcome: 'done',
        detail: linked ? `Draft response to ${linked.reference} created. It is internal until published.` : 'Draft created. It is internal until published.',
        toState: 'draft', alsoVisibleTo: linked ? caseVisible(linked) : [],
      });
      return clone(m);
    },
    async communicationStep(id, step, actor, note) {
      await wait();
      const m = commOrThrow(id);
      const ws = workspaceOrThrow(m.workspaceId);
      const linked = m.caseId ? store.cases.find((c) => c.id === m.caseId) : undefined;
      const action: AuditAction =
        step === 'submit' ? 'comm-submitted' : step === 'approve' ? 'comm-approved' : step === 'return' ? 'comm-returned' : 'comm-withdrawn';
      const base = {
        action, targetType: 'communication' as const, targetId: m.id, targetLabel: m.title, fromState: m.state,
        alsoVisibleTo: linked ? caseVisible(linked) : [],
      };
      // The actor must be acting in the workspace that owns the item; `decide*` check the actor's role in it.
      if (actor.workspaceId !== ws.id) refuse(actor, 'Only the workspace that wrote this can change it.', base);
      const d = step === 'approve' ? decideApproval(actor, m, ws) : decideCommStep(step, actor, m, ws);
      if (!d.allowed) refuse(actor, d.reason, base);
      const clean = note?.trim() ?? '';
      const needed = COMM_NOTE_REQUIRED[step];
      if (needed && !clean) throw new Error(needed);
      const from = m.state;
      const stamp = nowIso();
      let detail = '';
      if (step === 'submit') {
        m.state = 'in-review';
        delete m.reviewNote;
        delete m.reviewerName;
        detail = 'Submitted for review.';
      } else if (step === 'approve') {
        m.state = 'published';
        m.reviewerName = actor.name;
        m.publishedAt = stamp;
        detail = `Approved and published. Written by ${m.authorName}.`;
      } else if (step === 'return') {
        m.state = 'returned';
        m.reviewerName = actor.name;
        m.reviewNote = clean;
        detail = `Returned for changes: ${clean}`;
      } else {
        m.state = 'withdrawn';
        m.reviewerName = actor.name;
        m.reviewNote = clean;
        detail = `Withdrawn: ${clean}`;
      }
      m.updatedAt = stamp;
      record(actor, {
        action, targetType: 'communication', targetId: m.id, targetLabel: m.title, outcome: 'done', detail,
        fromState: from, toState: m.state, alsoVisibleTo: base.alsoVisibleTo,
      });
      return clone(m);
    },

    async audit(workspaceId) {
      await wait();
      workspaceOrThrow(workspaceId);
      return clone(store.audit.filter((e) => e.visibleTo.includes(workspaceId)).reverse());
    },
  };

  // Save the store after every call, so a change made on one screen is still there on the next.
  const wrapped = {} as Record<string, unknown>;
  for (const [name, fn] of Object.entries(port) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[name] = async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } finally {
        // A refusal writes an audit entry too, so save on failure as well.
        store.onChange?.();
      }
    };
  }
  return wrapped as unknown as GovernancePort;
}
