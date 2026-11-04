import type { CivicKind, Lens } from './schemas';

export const KIND_META: Record<CivicKind, { label: string; plural: string; color: string; lens: 'social' | 'civic' }> = {
  business: { label: 'Business', plural: 'Businesses', color: '#2f7d5b', lens: 'social' },
  place: { label: 'Place', plural: 'Places', color: '#4f63a8', lens: 'social' },
  event: { label: 'Event', plural: 'Events', color: '#b8860b', lens: 'social' },
  post: { label: 'Post', plural: 'Posts', color: '#5f6f68', lens: 'social' },
  organization: { label: 'Organization', plural: 'Organizations', color: '#7a4fa0', lens: 'civic' },
  issue: { label: 'Issue', plural: 'Issues', color: '#d9622b', lens: 'civic' },
  poll: { label: 'Poll', plural: 'Polls', color: '#c2417a', lens: 'civic' },
  project: { label: 'Project', plural: 'Projects', color: '#23809f', lens: 'civic' },
  alert: { label: 'Alert', plural: 'Alerts', color: '#b91c1c', lens: 'civic' },
};

export const KIND_ORDER = Object.keys(KIND_META) as CivicKind[];

export const LENS_META: Record<Lens, { label: string; hint: string }> = {
  social: { label: 'Social', hint: 'Places, businesses, events and posts' },
  civic: { label: 'Civic pulse', hint: 'Issues, polls, projects, alerts and organizations' },
  combined: { label: 'Combined', hint: 'Everything nearby' },
};

export function kindsForLens(lens: Lens): CivicKind[] {
  return KIND_ORDER.filter((k) => lens === 'combined' || KIND_META[k].lens === lens);
}
