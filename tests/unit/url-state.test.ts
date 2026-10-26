import { describe, expect, it } from 'vitest';
import { DEFAULT_URL_STATE, parseUrlState, toSearchString } from '@/features/map/url-state';

describe('map URL state', () => {
  it('uses defaults for an empty query string', () => {
    expect(parseUrlState('')).toEqual(DEFAULT_URL_STATE);
    expect(toSearchString(DEFAULT_URL_STATE)).toBe('');
  });

  it('round-trips every field', () => {
    const state = {
      city: 'toronto',
      lens: 'civic' as const,
      kinds: ['issue' as const, 'poll' as const],
      q: 'bike lanes',
      sel: 'boundary:toronto-core',
      areas: false,
      demo: 'error' as const,
    };
    expect(parseUrlState(toSearchString(state))).toEqual(state);
  });

  it('ignores invalid values instead of crashing', () => {
    const s = parseUrlState('?lens=nonsense&kinds=issue,dragon,issue&demo=boom&areas=0');
    expect(s.lens).toBe('combined');
    expect(s.kinds).toEqual(['issue']);
    expect(s.demo).toBeNull();
    expect(s.areas).toBe(false);
  });
});
