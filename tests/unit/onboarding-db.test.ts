/**
 * M07 addendum — the local database for onboarding (IndexedDB, with an
 * in-memory fallback). fake-indexeddb stands in for the browser's IndexedDB
 * in jsdom, so these tests exercise the real IndexedDB code path, not just
 * the fallback.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOnboardingData,
  deleteAccount,
  getAccount,
  getCurrentAccount,
  getSettings,
  listAccounts,
  resetOnboardingDbForTests,
  saveAccount,
  saveSettings,
  setCurrentAccount,
  updateAccountRole,
} from '@/lib/onboarding-db';
import type { OnboardingAccount } from '@/lib/schemas';

const NOW = '2026-11-07T12:00:00.000Z';

function account(overrides: Partial<OnboardingAccount> = {}): OnboardingAccount {
  return {
    email: 'demo@example.com',
    name: 'Demo Resident',
    branch: 'individual',
    organizationName: '',
    role: 'resident',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(async () => {
  await resetOnboardingDbForTests();
  window.sessionStorage.clear();
});

describe('the local database for onboarding (M07 addendum)', () => {
  it('saves an account in IndexedDB and reads it back', async () => {
    const where = await saveAccount(account());
    expect(where).toBe('indexeddb');
    const found = await getAccount('demo@example.com');
    expect(found).toEqual(account());
  });

  it('returns null for an email with no account', async () => {
    expect(await getAccount('nobody@example.com')).toBeNull();
  });

  it('treats the email as case-insensitive', async () => {
    await saveAccount(account());
    expect(await getAccount('DEMO@EXAMPLE.COM')).toEqual(account());
  });

  it('remembers which account is signed in, and forgets it', async () => {
    expect(await getCurrentAccount()).toBeNull();
    await saveAccount(account());
    await setCurrentAccount('demo@example.com');
    expect(await getCurrentAccount()).toEqual(account());
    await setCurrentAccount(null);
    expect(await getCurrentAccount()).toBeNull();
  });

  it('changes the role on a saved account', async () => {
    await saveAccount(account());
    const where = await updateAccountRole('demo@example.com', 'city-staff');
    expect(where).toBe('indexeddb');
    const found = await getAccount('demo@example.com');
    expect(found?.role).toBe('city-staff');
    expect(found?.updatedAt).not.toBe(NOW);
  });

  it('returns null when changing the role of an account that does not exist', async () => {
    expect(await updateAccountRole('nobody@example.com', 'city-staff')).toBeNull();
  });

  it('lists every saved account, oldest first', async () => {
    await saveAccount(account({ email: 'b@example.com', createdAt: '2026-11-07T12:00:00.000Z' }));
    await saveAccount(account({ email: 'a@example.com', createdAt: '2026-11-06T12:00:00.000Z' }));
    const all = await listAccounts();
    expect(all.map((a) => a.email)).toEqual(['a@example.com', 'b@example.com']);
  });

  it('removes one account without touching the others', async () => {
    await saveAccount(account());
    await saveAccount(account({ email: 'other@example.com' }));
    await deleteAccount('demo@example.com');
    expect(await getAccount('demo@example.com')).toBeNull();
    expect(await getAccount('other@example.com')).not.toBeNull();
  });

  it('saves settings and returns the defaults when nothing was saved', async () => {
    const defaults = await getSettings();
    expect(defaults.displayName).toBe('Demo resident');
    expect(defaults.currentAccountEmail).toBeNull();
    const where = await saveSettings({
      displayName: 'Fateh',
      showPublicly: false,
      shareLocation: true,
      largerText: true,
      currentAccountEmail: 'demo@example.com',
    });
    expect(where).toBe('indexeddb');
    const saved = await getSettings();
    expect(saved.displayName).toBe('Fateh');
    expect(saved.showPublicly).toBe(false);
    expect(saved.currentAccountEmail).toBe('demo@example.com');
  });

  it('discards a stored account record that fails validation', async () => {
    // Write a corrupt record straight into the database, bypassing saveAccount.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('neighbr-demo', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('accounts')) db.createObjectStore('accounts', { keyPath: 'email' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('accounts', 'readwrite');
        tx.objectStore('accounts').put({ email: 'broken@example.com', name: 42, role: 'superuser' });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    expect(await getAccount('broken@example.com')).toBeNull();
  });

  it('clears every account and setting', async () => {
    await saveAccount(account());
    await setCurrentAccount('demo@example.com');
    await saveSettings({
      displayName: 'Fateh',
      showPublicly: false,
      shareLocation: false,
      largerText: false,
      currentAccountEmail: 'demo@example.com',
    });
    const where = await clearOnboardingData();
    expect(where).toBe('indexeddb');
    expect(await listAccounts()).toEqual([]);
    expect(await getCurrentAccount()).toBeNull();
    expect((await getSettings()).displayName).toBe('Demo resident');
  });

  it('refuses an account that fails validation', async () => {
    await expect(
      saveAccount({ ...account(), role: 'superuser' as OnboardingAccount['role'] }),
    ).rejects.toThrow('Invalid onboarding account');
  });

  it('falls back to memory when IndexedDB is unavailable, and says so', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await resetOnboardingDbForTests();
    try {
      const where = await saveAccount(account());
      expect(where).toBe('memory');
      expect(await getAccount('demo@example.com')).toEqual(account());
    } finally {
      vi.unstubAllGlobals();
      await resetOnboardingDbForTests();
    }
  });
});
