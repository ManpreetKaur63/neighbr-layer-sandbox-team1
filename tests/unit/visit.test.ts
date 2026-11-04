import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/services/mock';
import { resolveVisit } from '@/lib/visit';

const { cities, session } = FIXTURES;
const city = (id: string) => cities.find((c) => c.id === id)!;

describe('resolveVisit', () => {
  it('shows a resident in their verified home city', () => {
    expect(resolveVisit(session, city('windsor'), cities)).toEqual({ mode: 'resident', label: 'Resident of Windsor' });
  });

  it('shows a visitor from the home city anywhere else, without changing the profile', () => {
    const v = resolveVisit(session, city('toronto'), cities);
    expect(v).toMatchObject({ mode: 'visitor', label: 'Visitor from Windsor', homeCityName: 'Windsor' });
    expect(session.homeCityId).toBe('windsor');
  });

  it('treats an unverified person as a plain visitor', () => {
    const v = resolveVisit({ displayName: 'Guest', role: 'visitor', homeCityId: null }, city('windsor'), cities);
    expect(v).toMatchObject({ mode: 'visitor', label: 'Visitor' });
  });
});
