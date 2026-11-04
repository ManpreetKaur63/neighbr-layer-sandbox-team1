'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 760px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True on phone-width screens. False on the server and where matchMedia is missing (tests, old browsers). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => false,
  );
}
