import {
  civicObjectSchema,
  civicRequestSchema,
  type BoundaryFeature,
  type CivicObject,
  type CivicRequest,
  type NotificationItem,
  type RequestAction,
  type RequestEvent,
  type Workspace,
  type WorkspaceMember,
} from '@/lib/schemas';
import { decide, denialMessage } from '@/lib/permissions';
import {
  ACTION_LABEL,
  HANDLER_FROM,
  ISSUE_STATUS_TEXT,
  NOTE_REQUIRED,
  STATUS_LABEL,
  isClosed,
} from '@/lib/requests';
import { pointInPolygon } from '@/lib/geo';
import type { HandlerActor, RequestPort } from '../ports';

/**
 * M06 request journey state. Pages in this shell each build their own mock
 * services, so state that must survive moving from the report form to the
 * workspace to the person's inbox lives in a store the services share. It is
 * in memory only: a full page reload resets it, which the docs say plainly.
 * Tests pass a fresh store so nothing leaks between them.
 */
export interface RequestStore {
  /** Called after any change; the running app uses it to save the store in the browser session. */
  onChange?: () => void;
  requests: CivicRequest[];
  /** Issue objects created by reports, so other pages (map, Pulse) see them and their status. */
  issueObjects: CivicObject[];
  readEventIds: Set<string>;
  seq: number;
}

export function createRequestStore(): RequestStore {
  return { requests: [], issueObjects: [], readEventIds: new Set(), seq: 0 };
}

const STORAGE_KEY = 'neighbr-demo-request-store-v1';

/**
 * The running app keeps its store in the browser session, so a report filed on
 * one screen is still there after a full page load or a link that opens a new
 * page (a different tab starts clean). Every read and write is wrapped: storage
 * can be unavailable or hold something unreadable, and then the demo simply
 * starts empty.
 */
function loadFromSession(store: RequestStore): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { requests?: unknown[]; issueObjects?: unknown[]; read?: unknown[]; seq?: unknown };
    for (const r of data.requests ?? []) {
      const parsed = civicRequestSchema.safeParse(r);
      if (parsed.success) store.requests.push(parsed.data);
    }
    for (const o of data.issueObjects ?? []) {
      const parsed = civicObjectSchema.safeParse(o);
      if (parsed.success) store.issueObjects.push(parsed.data);
    }
    for (const id of data.read ?? []) if (typeof id === 'string') store.readEventIds.add(id);
    if (typeof data.seq === 'number') store.seq = data.seq;
  } catch {
    /* unreadable saved state: start empty */
  }
}

function saveToSession(store: RequestStore): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ requests: store.requests, issueObjects: store.issueObjects, read: [...store.readEventIds], seq: store.seq }),
    );
  } catch {
    /* storage full or blocked: the demo still works inside this page load */
  }
}

/** The store the running app shares between pages (and keeps for the browser session). */
export const appRequestStore: RequestStore = createRequestStore();
loadFromSession(appRequestStore);
appRequestStore.onChange = () => saveToSession(appRequestStore);

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const nowIso = () => new Date().toISOString();

export interface RequestDeps {
  store: RequestStore;
  objects: CivicObject[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  /** Boundary features, used to route a located issue to the BIA that covers it. */
  boundaries: BoundaryFeature[];
  requesterName: string;
  wait: () => Promise<void>;
}

export function createRequestPort(deps: RequestDeps): RequestPort {
  const { store, objects, workspaces, members, boundaries, requesterName, wait } = deps;
  let eventSeq = 0;

  const eventId = () => `ev-${(store.seq += 1)}-${(eventSeq += 1)}`;

  function requestOrThrow(id: string): CivicRequest {
    const found = store.requests.find((r) => r.id === id);
    if (!found) throw new Error(`Request "${id}" not found.`);
    return found;
  }

  function workspaceOrThrow(id: string): Workspace {
    const found = workspaces.find((w) => w.id === id);
    if (!found) throw new Error(`Workspace "${id}" not found.`);
    return found;
  }

  function addEvent(r: CivicRequest, side: RequestEvent['side'], actor: string, action: RequestAction, note?: string) {
    const ev: RequestEvent = { id: eventId(), at: nowIso(), actor, side, action };
    if (note) ev.note = note;
    r.history.push(ev);
  }

  /** Write the status back onto the reported issue so the map and Pulse show the outcome. */
  function syncIssue(r: CivicRequest) {
    if (r.kind !== 'issue' || !r.objectId) return;
    const text = ISSUE_STATUS_TEXT[r.status];
    const stamp = new Date().toISOString().slice(0, 10);
    for (const o of [store.issueObjects.find((x) => x.id === r.objectId), objects.find((x) => x.id === r.objectId)]) {
      if (o) {
        o.status = text;
        o.updatedAt = stamp;
      }
    }
  }

  function setStatus(r: CivicRequest, status: CivicRequest['status']) {
    r.status = status;
    syncIssue(r);
  }

  /** Same gate as the workspace port: a restricted workspace is read-only, then the shared `decide` rule. */
  function guardHandler(r: CivicRequest, actor: HandlerActor) {
    const ws = workspaceOrThrow(r.workspaceId);
    const decision =
      ws.status === 'restricted'
        ? { allowed: false, reason: 'This workspace is restricted, so it is read-only.' }
        : decide('work', actor, ws.status);
    if (!decision.allowed) throw new Error(denialMessage(decision));
  }

  const out = (r: CivicRequest): CivicRequest => clone(r);

  const port: RequestPort = {
    async list(filter) {
      await wait();
      const all = 'mine' in filter ? store.requests.filter((r) => r.requester === requesterName) : store.requests.filter((r) => r.workspaceId === filter.workspaceId);
      return all.map(out).reverse();
    },
    async get(id) {
      await wait();
      const found = store.requests.find((r) => r.id === id);
      return found ? out(found) : null;
    },
    async create(input) {
      await wait();
      const title = input.title.trim();
      if (!title) throw new Error('A request needs a title.');
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        if (input.kind === 'issue') {
          const located = input.objectId ? objects.find((o) => o.id === input.objectId) : undefined;
          const candidates = workspaces.filter((w) => w.kind === 'bia' && w.cityId === input.cityId && w.status === 'verified');
          if (located) {
            // A located issue goes to the BIA whose boundary contains it, not to every BIA in the city.
            const inside = candidates.find((w) => {
              const area = w.boundaryId ? boundaries.find((b) => b.properties.id === w.boundaryId) : undefined;
              return area ? pointInPolygon(located.geo.coordinates, area.geometry.coordinates) : false;
            });
            if (!inside) {
              throw new Error('No BIA covers this location yet, so the report stays on the map but was not sent to a work queue.');
            }
            workspaceId = inside.id;
          } else {
            // No location to test (older callers): fall back to the city's verified BIA.
            workspaceId = candidates[0]?.id;
          }
        }
        if (!workspaceId) throw new Error('No organization in this city handles this kind of request yet.');
      }
      const ws = workspaceOrThrow(workspaceId);
      let object: CivicObject | undefined;
      if (input.objectId) {
        object = objects.find((o) => o.id === input.objectId);
        if (!object) throw new Error(`Object "${input.objectId}" not found.`);
      }
      if (input.kind === 'address') {
        if (!object || object.kind !== 'business') throw new Error('An address request must name a business listing.');
        if (object.workspaceId !== ws.id) throw new Error('That business is not managed by this workspace.');
      }
      const id = `req-${(store.seq += 1)}`;
      const request = civicRequestSchema.parse({
        id,
        kind: input.kind,
        title,
        summary: input.summary.trim(),
        cityId: input.cityId,
        objectId: input.objectId,
        workspaceId: ws.id,
        requester: requesterName,
        status: 'submitted',
        history: [],
        messages: [],
        synthetic: true,
      });
      addEvent(request, 'resident', requesterName, 'submitted', input.summary.trim() || undefined);
      store.requests.push(request);
      if (request.kind === 'issue' && object && !store.issueObjects.some((o) => o.id === object.id)) {
        store.issueObjects.push(clone(object));
      }
      return out(request);
    },
    async handle(id, input, actor) {
      await wait();
      const r = requestOrThrow(id);
      guardHandler(r, actor);
      if (!HANDLER_FROM[input.action].includes(r.status)) {
        throw new Error(`A request that is "${STATUS_LABEL[r.status]}" cannot take this step (${input.action}).`);
      }
      const note = input.note?.trim() ?? '';
      const needed = NOTE_REQUIRED[input.action];
      if (needed && !note) throw new Error(needed);

      switch (input.action) {
        case 'assign': {
          const person = members.find((m) => m.id === input.assigneeId && m.workspaceId === r.workspaceId);
          if (!person) throw new Error('Choose someone from this workspace to assign.');
          if (person.status !== 'active' || person.role === 'member') {
            throw new Error('Only an active owner or staff member can be assigned.');
          }
          r.assignee = { id: person.id, name: person.name };
          addEvent(r, 'handler', actor.name, 'assigned', `Assigned to ${person.name}.`);
          if (r.status === 'submitted') {
            setStatus(r, 'in-review');
            addEvent(r, 'handler', actor.name, 'review-started');
          }
          break;
        }
        case 'start-review':
          setStatus(r, 'in-review');
          addEvent(r, 'handler', actor.name, 'review-started');
          break;
        case 'ask-info':
          setStatus(r, 'needs-info');
          addEvent(r, 'handler', actor.name, 'info-requested', note);
          r.messages.push({ id: eventId(), at: nowIso(), from: 'handler', author: actor.name, text: note });
          break;
        case 'decline':
          setStatus(r, 'declined');
          addEvent(r, 'handler', actor.name, 'declined', note);
          r.messages.push({ id: eventId(), at: nowIso(), from: 'handler', author: actor.name, text: `Declined: ${note}` });
          break;
        case 'resolve':
          setStatus(r, 'resolved');
          addEvent(r, 'handler', actor.name, 'resolved', note);
          r.messages.push({ id: eventId(), at: nowIso(), from: 'handler', author: actor.name, text: `Resolved: ${note}` });
          break;
      }
      return out(r);
    },
    async send(id, text, actor) {
      await wait();
      const r = requestOrThrow(id);
      guardHandler(r, actor);
      const clean = text.trim();
      if (!clean) throw new Error('A message cannot be empty.');
      if (clean.length > 500) throw new Error('A message is too long (max 500 characters).');
      r.messages.push({ id: eventId(), at: nowIso(), from: 'handler', author: actor.name, text: clean });
      addEvent(r, 'handler', actor.name, 'message-sent');
      return out(r);
    },
    async reply(id, text) {
      await wait();
      const r = requestOrThrow(id);
      const clean = text.trim();
      if (!clean) throw new Error('A reply cannot be empty.');
      if (clean.length > 500) throw new Error('A reply is too long (max 500 characters).');
      if (isClosed(r.status)) throw new Error('This request is closed. Use Follow up to reopen it.');
      r.messages.push({ id: eventId(), at: nowIso(), from: 'resident', author: requesterName, text: clean });
      if (r.status === 'needs-info') {
        setStatus(r, 'in-review');
        addEvent(r, 'resident', requesterName, 'info-provided', clean);
      } else {
        addEvent(r, 'resident', requesterName, 'message-sent');
      }
      return out(r);
    },
    async reopen(id, note) {
      await wait();
      const r = requestOrThrow(id);
      if (!isClosed(r.status)) throw new Error('Only a resolved or declined request can be followed up.');
      const clean = note.trim();
      if (!clean) throw new Error('Say what is still wrong, so the team can act on it.');
      if (clean.length > 500) throw new Error('The note is too long (max 500 characters).');
      // The person can always follow up, even if the handling workspace has since become read-only.
      r.messages.push({ id: eventId(), at: nowIso(), from: 'resident', author: requesterName, text: `Follow-up: ${clean}` });
      setStatus(r, 'in-review');
      addEvent(r, 'resident', requesterName, 'reopened', clean);
      return out(r);
    },
  };

  // Save the store after every call, so a change made on one screen is still there on the next.
  const wrapped = {} as Record<string, unknown>;
  for (const [name, fn] of Object.entries(port) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    wrapped[name] = async (...args: unknown[]) => {
      const result = await fn(...args);
      store.onChange?.();
      return result;
    };
  }
  return wrapped as unknown as RequestPort;
}

/** Updates on the person's requests, shown in Notifications. Their read state lives in the shared store. */
export function requestNotifications(store: RequestStore, requesterName: string): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const r of store.requests) {
    if (r.requester !== requesterName) continue;
    for (const ev of r.history) {
      if (ev.side !== 'handler' || ev.action === 'assigned') continue;
      items.push({
        id: `note-${ev.id}`,
        title: `${ACTION_LABEL[ev.action]}: ${r.title}`,
        body: ev.note ?? `Status: ${STATUS_LABEL[r.status]}.`,
        createdAt: ev.at.slice(0, 10),
        read: store.readEventIds.has(ev.id),
        href: `/messages?id=${r.id}`,
        synthetic: true,
      });
    }
  }
  return items.reverse();
}
