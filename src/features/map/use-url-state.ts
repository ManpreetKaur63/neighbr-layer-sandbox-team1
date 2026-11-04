'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_URL_STATE, parseUrlState, toSearchString, type MapUrlState } from './url-state';

/**
 * Map state lives in the URL so any view can be shared or reloaded. The first render uses defaults
 * (so server and client markup match); `ready` flips once the real query string has been read.
 */
export function useUrlState() {
  const [state, setState] = useState<MapUrlState>(DEFAULT_URL_STATE);
  const [ready, setReady] = useState(false);
  const ref = useRef(state);

  useEffect(() => {
    const read = () => {
      const next = parseUrlState(window.location.search);
      ref.current = next;
      setState(next);
      setReady(true);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const update = useCallback((patch: Partial<MapUrlState>, opts?: { push?: boolean }) => {
    const next = { ...ref.current, ...patch };
    ref.current = next;
    setState(next);
    const url = `${window.location.pathname}${toSearchString(next)}`;
    if (opts?.push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  return { state, update, ready };
}
