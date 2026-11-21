// What the StellAurator Console desktop app keeps for this page (console-app/, docs/OWNER_CONSOLE.md).
//
// In a browser this file finds nothing and every function answers "not here": the device key stays
// in IndexedDB as a non-extractable CryptoKey (store.js) and the passphrase is typed once a sitting.
//
// In the desktop app, console-app/preload.cjs hands the page exactly three calls as
// `window.secrets`: get, set and clear, each by one of two names. Behind them is Electron's
// safeStorage, which encrypts with the Windows user account, so the owner never signs in again on
// that computer: the lock is the Windows account itself. The names are the whole list:
//
//   device      the device's key pair as JSON (the private half as a JWK) with its id and label
//   passphrase  the Gold desk passphrase, kept only once the back office has accepted it
//
// Nothing else is ever asked for, and nothing here writes to localStorage, IndexedDB or a file.
// It touches no document, so console-app/tests runs it under Node with a stand-in store.

export const SECRET_NAMES = ['device', 'passphrase'];

/** The bridge, or null in a browser. `api` lets a test hand in a stand-in. */
export function bridge(api = globalThis.secrets) {
  if (!api || typeof api !== 'object') return null;
  if (typeof api.get !== 'function' || typeof api.set !== 'function' || typeof api.clear !== 'function') return null;
  return api;
}

/** True only inside the desktop app. */
export const inApp = (api) => !!bridge(api);

const named = (name) => {
  if (!SECRET_NAMES.includes(name)) throw new Error(`The Console keeps no secret called "${name}".`);
  return name;
};

export async function getSecret(name, api) {
  const b = bridge(api);
  if (!b) return '';
  try { return String((await b.get(named(name))) || ''); } catch { return ''; }
}

export async function setSecret(name, value, api) {
  const b = bridge(api);
  if (!b) return false;
  try { return !!(await b.set(named(name), String(value || ''))); } catch { return false; }
}

export async function clearSecret(name, api) {
  const b = bridge(api);
  if (!b) return false;
  try { await b.clear(named(name)); return true; } catch { return false; }
}

/**
 * The passphrase a sitting opens with: the stored one first, and '' (ask for it) when this is a
 * browser or nothing is stored. The store is always read BEFORE the box is drawn.
 */
export const storedPassphrase = (api) => getSecret('passphrase', api);
export const keepPassphrase = (value, api) => setSecret('passphrase', value, api);
export const forgetPassphrase = (api) => clearSecret('passphrase', api);
