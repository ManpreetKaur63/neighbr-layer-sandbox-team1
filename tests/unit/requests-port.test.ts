import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { createRequestStore } from '@/services/mock/requests';
import type { HandlerActor } from '@/services/ports';
import { accessLines } from '@/lib/requests';

const coordinator: HandlerActor = { name: 'Demo corridor coordinator', role: 'staff', memberStatus: 'active' };
const chair: HandlerActor = { name: 'Demo BIA chair', role: 'owner', memberStatus: 'active' };
const viewer: HandlerActor = { name: 'Demo viewer', role: 'member', memberStatus: 'active' };
const invited: HandlerActor = { name: 'Demo invited', role: 'staff', memberStatus: 'invited' };

function setup() {
  const store = createRequestStore();
  return { store, s: createMockServices({ requestStore: store }) };
}

async function fileIssue(s: ReturnType<typeof createMockServices>) {
  const issue = await s.social.reportIssue({
    title: 'Pothole on Riverside',
    summary: 'Near the bakery',
    cityId: 'windsor',
    coordinates: [-82.989, 42.3244], // inside the Olde Riverside corridor
  });
  return s.requests.create({ kind: 'issue', title: issue.title, summary: issue.summary, cityId: 'windsor', objectId: issue.id });
}

describe('request journey: submit and route (M06)', () => {
  it('routes a reported issue to the BIA of the city and records who submitted it', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    expect(r.workspaceId).toBe('ws-bia-sample');
    expect(r.status).toBe('submitted');
    expect(r.requester).toBe('Demo resident');
    expect(r.history).toHaveLength(1);
    expect(r.history[0]).toMatchObject({ action: 'submitted', side: 'resident', actor: 'Demo resident' });
  });

  it('shows the request in the work queue of the handling workspace and in the person’s own list', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    expect((await s.requests.list({ workspaceId: 'ws-bia-sample' })).map((x) => x.id)).toEqual([r.id]);
    expect((await s.requests.list({ mine: true })).map((x) => x.id)).toEqual([r.id]);
    expect(await s.requests.list({ workspaceId: 'ws-biz-bakery' })).toEqual([]);
  });

  it('shares state between separate service instances, as the pages in the app do', async () => {
    const store = createRequestStore();
    const reportPage = createMockServices({ requestStore: store });
    const workspacePage = createMockServices({ requestStore: store });
    const r = await fileIssue(reportPage);
    expect((await workspacePage.requests.get(r.id))?.title).toBe('Pothole on Riverside');
    const mapPage = createMockServices({ requestStore: store });
    const onMap = await mapPage.objects.get(r.objectId as string);
    expect(onMap?.status).toBe('Open');
  });

  it('rejects an empty title, an unknown object and a city with no handler', async () => {
    const { s } = setup();
    await expect(s.requests.create({ kind: 'issue', title: '  ', summary: '', cityId: 'windsor' })).rejects.toThrow(/title/);
    await expect(
      s.requests.create({ kind: 'issue', title: 'x', summary: '', cityId: 'windsor', objectId: 'nope' }),
    ).rejects.toThrow(/not found/);
    await expect(s.requests.create({ kind: 'issue', title: 'x', summary: '', cityId: 'toronto' })).rejects.toThrow(/No organization/);
  });

  it('returns null for an unknown request and rejects actions on it', async () => {
    const { s } = setup();
    expect(await s.requests.get('req-nope')).toBeNull();
    await expect(s.requests.handle('req-nope', { action: 'start-review' }, coordinator)).rejects.toThrow(/not found/);
  });
});

describe('request journey: the organization handles it (M06)', () => {
  it('assigns to an active staff member, which starts the review, and records both steps', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    const after = await s.requests.handle(r.id, { action: 'assign', assigneeId: 'm-bia-2' }, chair);
    expect(after.status).toBe('in-review');
    expect(after.assignee).toEqual({ id: 'm-bia-2', name: 'Demo corridor coordinator' });
    expect(after.history.map((e) => e.action)).toEqual(['submitted', 'assigned', 'review-started']);
    expect(after.history[1]?.actor).toBe('Demo BIA chair');
  });

  it('refuses to assign an invited member, a member role, or someone from another workspace', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    await expect(s.requests.handle(r.id, { action: 'assign', assigneeId: 'm-bia-3' }, chair)).rejects.toThrow(/active owner or staff/);
    await expect(s.requests.handle(r.id, { action: 'assign', assigneeId: 'm-bak-1' }, chair)).rejects.toThrow(/Choose someone/);
  });

  it('resolves only after review, needs a note, and writes the outcome back to the issue on the map', async () => {
    const { s, store } = setup();
    const r = await fileIssue(s);
    await expect(s.requests.handle(r.id, { action: 'resolve', note: 'Filled' }, coordinator)).rejects.toThrow(/cannot take this step/);
    await s.requests.handle(r.id, { action: 'start-review' }, coordinator);
    await expect(s.requests.handle(r.id, { action: 'resolve', note: ' ' }, coordinator)).rejects.toThrow(/what was done/);
    const done = await s.requests.handle(r.id, { action: 'resolve', note: 'Pothole filled' }, coordinator);
    expect(done.status).toBe('resolved');
    expect(done.messages.at(-1)?.text).toBe('Resolved: Pothole filled');
    expect(store.issueObjects[0]?.status).toBe('Resolved');
  });

  it('asks for more information, and the person’s reply puts it back into review', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    await s.requests.handle(r.id, { action: 'start-review' }, coordinator);
    await expect(s.requests.handle(r.id, { action: 'ask-info', note: '' }, coordinator)).rejects.toThrow(/information is needed/);
    const asked = await s.requests.handle(r.id, { action: 'ask-info', note: 'Which side of the street?' }, coordinator);
    expect(asked.status).toBe('needs-info');
    expect(asked.messages.at(-1)).toMatchObject({ from: 'handler', text: 'Which side of the street?' });
    const replied = await s.requests.reply(r.id, 'The north side');
    expect(replied.status).toBe('in-review');
    expect(replied.history.at(-1)?.action).toBe('info-provided');
  });

  it('declines with a reason, and the person can follow up to reopen it', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    await expect(s.requests.handle(r.id, { action: 'decline' }, coordinator)).rejects.toThrow(/reason/);
    const declined = await s.requests.handle(r.id, { action: 'decline', note: 'This is a city road; we passed it on.' }, coordinator);
    expect(declined.status).toBe('declined');
    await expect(s.requests.reply(r.id, 'hello?')).rejects.toThrow(/Follow up/);
    await expect(s.requests.reopen(r.id, ' ')).rejects.toThrow(/still wrong/);
    const reopened = await s.requests.reopen(r.id, 'The city says it is yours.');
    expect(reopened.status).toBe('in-review');
    expect(reopened.history.at(-1)?.action).toBe('reopened');
    await expect(s.requests.reopen(r.id, 'again')).rejects.toThrow(/Only a resolved or declined/);
  });

  it('lets the organization message the person and records it', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    const sent = await s.requests.send(r.id, 'Crew booked for Tuesday.', coordinator);
    expect(sent.messages.at(-1)).toMatchObject({ from: 'handler', author: 'Demo corridor coordinator' });
    expect(sent.history.at(-1)?.action).toBe('message-sent');
    await expect(s.requests.send(r.id, '   ', coordinator)).rejects.toThrow(/empty/);
  });
});

describe('request journey: permissions and states (M06)', () => {
  it('rejects a view-only member and an uninvited person, with the shared reason', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    await expect(s.requests.handle(r.id, { action: 'start-review' }, viewer)).rejects.toThrow(/Not allowed: The member role cannot work/);
    await expect(s.requests.send(r.id, 'hi', viewer)).rejects.toThrow(/Not allowed/);
    await expect(s.requests.handle(r.id, { action: 'start-review' }, invited)).rejects.toThrow(/invitation has not been accepted/);
    expect((await s.requests.get(r.id))?.status).toBe('submitted');
  });

  it('routes an address request to the business and lets the owner handle it', async () => {
    const { s } = setup();
    const r = await s.requests.create({
      kind: 'address', title: 'Address for Weekend bread bundle', summary: 'Pick-up', cityId: 'windsor',
      objectId: 'w-bakery', workspaceId: 'ws-biz-bakery',
    });
    expect(r.workspaceId).toBe('ws-biz-bakery');
    const owner: HandlerActor = { name: 'Demo bakery owner', role: 'owner', memberStatus: 'active' };
    await s.requests.handle(r.id, { action: 'start-review' }, owner);
    const done = await s.requests.handle(r.id, { action: 'resolve', note: 'Demo address shared (invented).' }, owner);
    expect(done.status).toBe('resolved');
  });

  it('rejects an address request for a business the workspace does not manage', async () => {
    const { s } = setup();
    await expect(
      s.requests.create({ kind: 'address', title: 'x', summary: '', cityId: 'windsor', objectId: 'w-hardware', workspaceId: 'ws-biz-bakery' }),
    ).rejects.toThrow(/not managed/);
  });

  it('writes the access lines the screen shows from the same rule the service enforces', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    const labels = { owner: 'Owner', staff: 'Staff', member: 'Member' } as const;
    const verified = accessLines(r, 'Sample BIA', labels, 'verified');
    expect(verified.map((l) => l.who)).toHaveLength(4);
    expect(verified[2]?.can).toMatch(/View only/);
    const restricted = accessLines(r, 'Sample BIA', labels, 'restricted');
    expect(restricted[1]?.can).toMatch(/read-only/);
  });

  it('turns the organization’s updates into notifications for the person, and marks them read', async () => {
    const { s } = setup();
    const r = await fileIssue(s);
    await s.requests.handle(r.id, { action: 'decline', note: 'Not ours.' }, coordinator);
    const before = (await s.social.notifications()).filter((n) => n.href.startsWith('/messages'));
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ read: false, body: 'Not ours.' });
    await s.social.markNotificationsRead();
    const after = (await s.social.notifications()).filter((n) => n.href.startsWith('/messages'));
    expect(after[0]?.read).toBe(true);
  });
});
