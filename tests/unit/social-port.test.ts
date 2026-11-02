import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';

describe('social port (M04)', () => {
  it('likes are idempotent: react twice counts once, unreact restores', async () => {
    const s = createMockServices();
    const before = await s.social.likes('w-transit-poll');
    await s.social.react('w-transit-poll');
    expect(await s.social.react('w-transit-poll')).toBe(before + 1);
    expect(await s.social.liked()).toContain('w-transit-poll');
    expect(await s.social.unreact('w-transit-poll')).toBe(before);
    expect(await s.social.liked()).not.toContain('w-transit-poll');
  });

  it('rejects reactions on unknown objects', async () => {
    const s = createMockServices();
    await expect(s.social.react('nope')).rejects.toThrow(/not found/);
    await expect(s.social.unreact('nope')).rejects.toThrow(/not found/);
    await expect(s.social.likes('nope')).rejects.toThrow(/not found/);
  });

  it('adds and lists comments per object', async () => {
    const s = createMockServices();
    const before = await s.social.comments('w-transit-poll');
    const c = await s.social.addComment('w-transit-poll', 'A test comment');
    expect(c.objectId).toBe('w-transit-poll');
    expect(c.text).toBe('A test comment');
    expect((await s.social.comments('w-transit-poll')).length).toBe(before.length + 1);
  });

  it('rejects empty, overlong or orphaned comments', async () => {
    const s = createMockServices();
    await expect(s.social.addComment('w-transit-poll', '   ')).rejects.toThrow(/empty/);
    await expect(s.social.addComment('w-transit-poll', 'x'.repeat(501))).rejects.toThrow(/too long/);
    await expect(s.social.addComment('nope', 'hi')).rejects.toThrow(/not found/);
  });

  it('toggles saves', async () => {
    const s = createMockServices();
    expect(await s.social.toggleSave('w-hours-poll')).toBe(true);
    expect(await s.social.saved()).toContain('w-hours-poll');
    expect(await s.social.toggleSave('w-hours-poll')).toBe(false);
    expect(await s.social.saved()).not.toContain('w-hours-poll');
  });

  it('rejects saving unknown objects', async () => {
    const s = createMockServices();
    await expect(s.social.toggleSave('nope')).rejects.toThrow(/not found/);
  });

  it('follows and unfollows', async () => {
    const s = createMockServices();
    await s.social.follow('org-1');
    expect(await s.social.following()).toContain('org-1');
    await s.social.unfollow('org-1');
    expect(await s.social.following()).not.toContain('org-1');
  });

  it('rejects following with an empty target', async () => {
    const s = createMockServices();
    await expect(s.social.follow('  ')).rejects.toThrow(/required/);
  });

  it('lists notifications and marks them read', async () => {
    const s = createMockServices();
    const list = await s.social.notifications();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((n) => !n.read)).toBe(true);
    await s.social.markNotificationsRead();
    expect((await s.social.notifications()).every((n) => n.read)).toBe(true);
  });
});

describe('poll voting (M04)', () => {
  it('increments the chosen option', async () => {
    const s = createMockServices();
    const poll = (await s.objects.get('w-hours-poll'))!;
    const option = poll.poll!.options[0]!;
    const optionId = option.id;
    const before = option.votes;
    const updated = await s.social.vote('w-hours-poll', optionId);
    expect(updated.poll!.options[0]!.votes).toBe(before + 1);
  });

  it('rejects votes on unknown polls, non-polls, unknown options', async () => {
    const s = createMockServices();
    await expect(s.social.vote('nope', 'x')).rejects.toThrow(/not found/);
    await expect(s.social.vote('w-bakery', 'x')).rejects.toThrow(/not a poll/);
    await expect(s.social.vote('w-hours-poll', 'nope')).rejects.toThrow(/Option .* not found/);
  });

  it('rejects votes on closed polls', async () => {
    const s = createMockServices();
    const poll = await s.social.createPoll({ question: 'Closed?', options: ['A', 'B'], cityId: 'windsor' });
    // close it through the working copy, then vote
    const stored = (await s.objects.get(poll.id))!;
    stored.poll!.closed = true;
    await expect(s.social.vote(poll.id, stored.poll!.options[0]!.id)).rejects.toThrow(/closed/);
  });

  it('creates polls with validation', async () => {
    const s = createMockServices();
    const poll = await s.social.createPoll({ question: 'Test?', options: ['A', 'B', 'C'], cityId: 'windsor' });
    expect(poll.kind).toBe('poll');
    expect(poll.poll!.options).toHaveLength(3);
    expect(poll.poll!.options.every((o) => o.votes === 0)).toBe(true);
    await expect(s.social.createPoll({ question: '  ', options: ['A', 'B'], cityId: 'windsor' })).rejects.toThrow(/question/);
    await expect(s.social.createPoll({ question: 'Q?', options: ['A'], cityId: 'windsor' })).rejects.toThrow(/two options/);
  });
});

describe('issue reporting (M04)', () => {
  it('creates an open issue object', async () => {
    const s = createMockServices();
    const issue = await s.social.reportIssue({ title: 'Test issue', summary: 'Detail', cityId: 'windsor' });
    expect(issue.kind).toBe('issue');
    expect(issue.status).toBe('Open');
    expect(await s.objects.get(issue.id)).not.toBeNull();
  });

  it('rejects reports with an empty title', async () => {
    const s = createMockServices();
    await expect(s.social.reportIssue({ title: '  ', summary: 'x', cityId: 'windsor' })).rejects.toThrow(/title/);
  });

  it('keeps factory instances isolated', async () => {
    const a = createMockServices();
    const b = createMockServices();
    await a.social.reportIssue({ title: 'Only in A', summary: '', cityId: 'windsor' });
    const inB = await b.objects.list({ cityId: 'windsor', kinds: ['issue'], text: 'Only in A' });
    expect(inB).toEqual([]);
  });
});
