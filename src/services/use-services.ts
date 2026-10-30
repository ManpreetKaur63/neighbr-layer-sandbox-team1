'use client';

import { useMemo } from 'react';
import type { Services } from './ports';
import { getSessionServices } from './session';

/** The shared demo-session services (see session.ts). Use this instead of createMockServices() in screens. */
export function useServices(): Services {
  return useMemo(() => getSessionServices(), []);
}
