import type { City, UserContext } from './schemas';

export type VisitContext =
  | { mode: 'resident'; label: string }
  | { mode: 'visitor'; label: string; homeCityName: string | null };

/**
 * A person keeps one fixed profile. Looking at another city never converts it:
 * it only creates visitor context for that view.
 */
export function resolveVisit(user: UserContext, viewing: City, cities: City[]): VisitContext {
  if (user.role === 'resident' && user.homeCityId === viewing.id) {
    return { mode: 'resident', label: `Resident of ${viewing.name}` };
  }
  const home = cities.find((c) => c.id === user.homeCityId)?.name ?? null;
  return {
    mode: 'visitor',
    homeCityName: home,
    label: home ? `Visitor from ${home}` : 'Visitor',
  };
}
