import type { Services } from './ports';
import { createMockServices } from './mock';

/**
 * One shared service instance per browser tab. Every screen (map, pulse, report,
 * BIA and business workspaces, notifications, directory) gets the SAME instance,
 * so a change made on one screen is what the next screen reads. The state is also
 * saved to sessionStorage, so it survives a full page load or a pasted deep link
 * within the same tab. Nothing leaves the browser.
 */
export const SESSION_KEY = 'neighbr-demo-session-v1';

let shared: Services | null = null;

export function getSessionServices(): Services {
  shared ??= createMockServices({ persistKey: SESSION_KEY });
  return shared;
}

/** Forget every change made in this demo session and start again from the fixtures. */
export function resetSessionServices(): void {
  shared = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
