import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import type { ActorContext } from '@/lib/permissions';

const staff: ActorContext = { role: 'staff', memberStatus: 'active' };
const member: ActorContext = { role: 'member', memberStatus: 'active' };

/** t-bia-vacancy starts 'open' in the seeds; every test gets a fresh factory. */
async function openTask() {
  const s = createMockServices();
  const tasks = await s.workspaces.tasks('ws-bia-sample');
  const t = tasks.find((x) => x.id === 't-bia-vacancy');
  if (!t) throw new Error('seed task t-bia-vacancy missing');
  return { s, t };
}

describe('request decisions: decline and more information (Week 6)', () => {
  it('declines an open request with a recorded reason', async () => {
    const { s, t } = await openTask();
    const out = await s.workspaces.declineTask('ws-bia-sample', t.id, 'Duplicate of an existing request.', staff);
    expect(out.status).toBe('declined');
    expect(out.note).toBe('Duplicate of an existing request.');
  });

  it('declining needs a reason, so the requester knows why', async () => {
    const { s, t } = await openTask();
    await expect(s.workspaces.declineTask('ws-bia-sample', t.id, '   ', staff)).rejects.toThrow(/needs a reason/);
  });

  it('a declined request is closed: it cannot move or be reopened', async () => {
    const { s, t } = await openTask();
    await s.workspaces.declineTask('ws-bia-sample', t.id, 'Out of scope.', staff);
    await expect(s.workspaces.updateTask('ws-bia-sample', t.id, 'in-progress', staff)).rejects.toThrow(/closed/);
    await expect(s.workspaces.provideTaskInfo('ws-bia-sample', t.id, 'more info', staff)).rejects.toThrow(
      /not waiting for information/,
    );
  });

  it('only an open or in-progress request can be declined', async () => {
    const { s, t } = await openTask();
    await s.workspaces.updateTask('ws-bia-sample', t.id, 'in-progress', staff);
    await s.workspaces.updateTask('ws-bia-sample', t.id, 'done', staff);
    await expect(s.workspaces.declineTask('ws-bia-sample', t.id, 'too late', staff)).rejects.toThrow(/Only an open or in-progress/);
  });

  it('sends a request back for more information and returns it to open when provided', async () => {
    const { s, t } = await openTask();
    const waiting = await s.workspaces.requestTaskInfo('ws-bia-sample', t.id, 'Which storefront?', staff);
    expect(waiting.status).toBe('needs-info');
    expect(waiting.note).toBe('Which storefront?');
    const reopened = await s.workspaces.provideTaskInfo('ws-bia-sample', t.id, '123 Riverside Dr.', staff);
    expect(reopened.status).toBe('open');
    expect(reopened.note).toMatch(/Information provided/);
  });

  it('requesting information needs a note saying what is needed', async () => {
    const { s, t } = await openTask();
    await expect(s.workspaces.requestTaskInfo('ws-bia-sample', t.id, '', staff)).rejects.toThrow(/what information is needed/);
  });

  it('a member with view-only access cannot decline or request information', async () => {
    const { s, t } = await openTask();
    await expect(s.workspaces.declineTask('ws-bia-sample', t.id, 'nope', member)).rejects.toThrow(/Not allowed/);
    await expect(s.workspaces.requestTaskInfo('ws-bia-sample', t.id, 'nope', member)).rejects.toThrow(/Not allowed/);
  });

  it('a restricted workspace rejects request decisions', async () => {
    const s = createMockServices();
    const tasks = await s.workspaces.tasks('ws-school-academy');
    const first = tasks[0];
    if (!first) throw new Error('ws-school-academy should seed tasks');
    await expect(s.workspaces.declineTask('ws-school-academy', first.id, 'nope', staff)).rejects.toThrow(/read-only/);
  });
});
