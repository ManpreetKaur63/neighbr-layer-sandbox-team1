import {
  onboardingAccountSchema,
  onboardingSettingsSchema,
  type OnboardingAccount,
  type OnboardingRole,
  type OnboardingSettings,
} from './schemas';

/**
 * M07 addendum — the local database for the onboarding process.
 *
 * Signup now saves a real record on the device, in IndexedDB (the browser's
 * own local database; no server, no network): database `neighbr-demo`,
 * version 1, two object stores —
 *
 *   accounts  (key: email)    — one OnboardingAccount per demo account
 *   settings  (key: 'main')   — one OnboardingSettings record
 *
 * What is stored: name, email, branch, organization name, role, and the
 * profile/preference settings. What is NEVER stored: the password — signup
 * validates it and throws it away. Sign-in looks the email up here; the
 * profile page shows the saved account; Settings reads and writes here.
 *
 * When IndexedDB is unavailable (private mode, blocked storage, a test
 * environment without it) the same calls fall back to plain in-memory maps,
 * so the app still works — and every call reports where the data went, so
 * the UI can say so honestly instead of pretending it was saved.
 */

export const ONBOARDING_DB_NAME = 'neighbr-demo';
export const ONBOARDING_DB_VERSION = 1;

const ACCOUNTS_STORE = 'accounts';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'main';

const DEFAULT_SETTINGS: OnboardingSettings = {
  key: SETTINGS_KEY,
  displayName: 'Demo resident',
  showPublicly: true,
  shareLocation: false,
  largerText: false,
  currentAccountEmail: null,
};

/** Where a call ended up. 'indexeddb' persists across sessions; 'memory' lasts only for this page. */
export type OnboardingStorage = 'indexeddb' | 'memory';

let dbPromise: Promise<IDBDatabase | null> | null = null;
/** In-memory fallback, used only when IndexedDB is unavailable. */
const memoryAccounts = new Map<string, OnboardingAccount>();
let memorySettings: OnboardingSettings | null = null;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(ONBOARDING_DB_NAME, ONBOARDING_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ACCOUNTS_STORE)) {
          db.createObjectStore(ACCOUNTS_STORE, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function putRecord<T>(store: string, value: T): Promise<OnboardingStorage> {
  const db = await openDb();
  if (!db) {
    if (store === ACCOUNTS_STORE) memoryAccounts.set((value as OnboardingAccount).email, value as OnboardingAccount);
    if (store === SETTINGS_STORE) memorySettings = value as OnboardingSettings;
    return 'memory';
  }
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await transactionDone(tx);
    return 'indexeddb';
  } catch {
    if (store === ACCOUNTS_STORE) memoryAccounts.set((value as OnboardingAccount).email, value as OnboardingAccount);
    if (store === SETTINGS_STORE) memorySettings = value as OnboardingSettings;
    return 'memory';
  }
}

async function getRecord<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) {
    if (store === ACCOUNTS_STORE) return memoryAccounts.get(key) as T | undefined;
    if (store === SETTINGS_STORE) return (memorySettings ?? undefined) as T | undefined;
    return undefined;
  }
  try {
    const tx = db.transaction(store, 'readonly');
    const result = await request(tx.objectStore(store).get(key));
    await transactionDone(tx);
    return result as T | undefined;
  } catch {
    if (store === ACCOUNTS_STORE) return memoryAccounts.get(key) as T | undefined;
    if (store === SETTINGS_STORE) return (memorySettings ?? undefined) as T | undefined;
    return undefined;
  }
}

async function getAllRecords<T>(store: string): Promise<T[]> {
  const db = await openDb();
  if (!db) {
    if (store === ACCOUNTS_STORE) return [...memoryAccounts.values()] as T[];
    return [];
  }
  try {
    const tx = db.transaction(store, 'readonly');
    const result = await request(tx.objectStore(store).getAll());
    await transactionDone(tx);
    return (result ?? []) as T[];
  } catch {
    if (store === ACCOUNTS_STORE) return [...memoryAccounts.values()] as T[];
    return [];
  }
}

async function deleteRecord(store: string, key: string): Promise<OnboardingStorage> {
  const db = await openDb();
  if (!db) {
    if (store === ACCOUNTS_STORE) memoryAccounts.delete(key);
    return 'memory';
  }
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await transactionDone(tx);
    return 'indexeddb';
  } catch {
    if (store === ACCOUNTS_STORE) memoryAccounts.delete(key);
    return 'memory';
  }
}

/** Save (or replace) a demo account. Returns where it was stored. */
export async function saveAccount(account: OnboardingAccount): Promise<OnboardingStorage> {
  const checked = onboardingAccountSchema.safeParse(account);
  if (!checked.success) throw new Error('Invalid onboarding account');
  return putRecord(ACCOUNTS_STORE, checked.data);
}

/** The account for this email, or null when none was saved (or the stored record is invalid). */
export async function getAccount(email: string): Promise<OnboardingAccount | null> {
  const raw = await getRecord<unknown>(ACCOUNTS_STORE, email.trim().toLowerCase());
  if (raw === undefined) return null;
  const checked = onboardingAccountSchema.safeParse(raw);
  return checked.success ? checked.data : null;
}

/** Every saved demo account, oldest first. */
export async function listAccounts(): Promise<OnboardingAccount[]> {
  const raw = await getAllRecords<unknown>(ACCOUNTS_STORE);
  return raw
    .map((r) => onboardingAccountSchema.safeParse(r))
    .filter((r): r is { success: true; data: OnboardingAccount } => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Remove one account (used when its email is changed in Settings). */
export async function deleteAccount(email: string): Promise<OnboardingStorage> {
  return deleteRecord(ACCOUNTS_STORE, email.trim().toLowerCase());
}

/** The signed-in account on this device, or null when nobody signed in yet. */
export async function getCurrentAccount(): Promise<OnboardingAccount | null> {
  const settings = await getSettings();
  if (!settings.currentAccountEmail) return null;
  return getAccount(settings.currentAccountEmail);
}

/** Remember which account is signed in on this device. */
export async function setCurrentAccount(email: string | null): Promise<OnboardingStorage> {
  const settings = await getSettings();
  return saveSettings({ ...settings, currentAccountEmail: email?.trim().toLowerCase() ?? null });
}

/** Change the role on a saved account (Settings), and refresh its updated date. */
export async function updateAccountRole(email: string, role: OnboardingRole): Promise<OnboardingStorage | null> {
  const account = await getAccount(email);
  if (!account) return null;
  return saveAccount({ ...account, role, updatedAt: new Date().toISOString() });
}

/** The settings record, or the defaults when nothing was saved yet. */
export async function getSettings(): Promise<OnboardingSettings> {
  const raw = await getRecord<unknown>(SETTINGS_STORE, SETTINGS_KEY);
  if (raw === undefined) return DEFAULT_SETTINGS;
  const checked = onboardingSettingsSchema.safeParse(raw);
  return checked.success ? checked.data : DEFAULT_SETTINGS;
}

/** Merge new values into the settings record and save it. */
export async function saveSettings(
  next: Omit<OnboardingSettings, 'key'>,
): Promise<OnboardingStorage> {
  const record: OnboardingSettings = { key: SETTINGS_KEY, ...next };
  const checked = onboardingSettingsSchema.safeParse(record);
  if (!checked.success) throw new Error('Invalid onboarding settings');
  return putRecord(SETTINGS_STORE, checked.data);
}

async function clearStore(store: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await transactionDone(tx);
}

/** Delete the whole local database (Settings: "Clear demo data"). */
export async function clearOnboardingData(): Promise<OnboardingStorage> {
  memoryAccounts.clear();
  memorySettings = null;
  if (typeof indexedDB === 'undefined') return 'memory';
  try {
    // Empty the stores rather than deleting the database: deleting can hang
    // while another tab holds the database open, and an empty store is an
    // empty database from the demo's point of view.
    await clearStore(ACCOUNTS_STORE);
    await clearStore(SETTINGS_STORE);
    return 'indexeddb';
  } catch {
    return 'memory';
  }
}

/**
 * Test-only: empty the stores and clear the in-memory fallback, so each
 * test starts from an empty store. Not used by the app.
 */
export async function resetOnboardingDbForTests(): Promise<void> {
  memoryAccounts.clear();
  memorySettings = null;
  if (typeof indexedDB === 'undefined') {
    dbPromise = null;
    return;
  }
  try {
    await clearStore(ACCOUNTS_STORE);
    await clearStore(SETTINGS_STORE);
  } catch {
    /* a fresh test still starts from an empty fallback */
  }
}
