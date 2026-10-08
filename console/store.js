// What this device remembers — IndexedDB, and nothing else.
//
// Three stores, and the list is the whole privacy story of the Console:
//
//   device     the key pair (the private half a non-extractable CryptoKey, which IndexedDB stores
//              by reference - the bytes never exist in the page), the device id and its label.
//   readings   the daily readings of GitHub's public download totals, so a per-day line can be
//              drawn from running totals. Public numbers; nobody is in them.
//   prefs      which page was open and which window was chosen. Conveniences.
//
// **The passphrase is never here.** It lives in one variable in console.js for as long as the
// Console is open, and is dropped after fifteen idle minutes or five minutes hidden. Nothing in
// this file can hold it: there is no store for it, and `put` names its store.
//
// Every read and write is wrapped: a private window, cleared site data or a browser that refuses
// storage has to mean "this device is not linked yet", not a blank screen.

const DB_NAME = 'stellaurator-console';
const DB_VERSION = 1;
export const STORES = ['device', 'readings', 'prefs'];

let opening = null;

function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('This browser will not let the Console store its key.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('The Console could not open its own storage.'));
    req.onblocked = () => reject(new Error('Another Console tab is upgrading this storage. Close the other tab and reload.'));
  }).catch((e) => { opening = null; throw e; });
  return opening;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.onabort = () => reject(tx.error || new Error('That did not save.'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('That did not save.'));
  });
}

export async function get(store, key) {
  try { return await run(store, 'readonly', (s) => s.get(key)); } catch { return undefined; }
}

export async function put(store, key, value) {
  try { await run(store, 'readwrite', (s) => s.put(value, key)); return true; } catch { return false; }
}

export async function drop(store, key) {
  try { await run(store, 'readwrite', (s) => s.delete(key)); return true; } catch { return false; }
}

// ---- the device -------------------------------------------------------------------------------

/** -> { deviceId, label, linkedAt, publicJwk, privateKey } | null */
export const readDevice = () => get('device', 'me');

export async function saveDevice(device) {
  const saved = await put('device', 'me', device);
  if (!saved) throw new Error('This device could not keep its key, so it cannot be linked. That usually means private browsing, or site data being blocked - open the Console in a normal window.');
  return device;
}

export const forgetDevice = () => drop('device', 'me');

// ---- the download readings --------------------------------------------------------------------

export async function readReadings() {
  const rows = await get('readings', 'github');
  return Array.isArray(rows) ? rows : [];
}

export const saveReadings = (rows) => put('readings', 'github', rows);

// ---- small conveniences ----------------------------------------------------------------------

export async function readPrefs() {
  const p = await get('prefs', 'ui');
  return p && typeof p === 'object' ? p : {};
}

export const savePrefs = (p) => put('prefs', 'ui', p || {});
