// The Console inside the account site: the screen's half of the postMessage bridge.
//
// (docs/OWNER_CONSOLE.md "Inside the account site (no link code)"; the page's half is
// site/wix/pages/console.js, whose header lists the protocol.)
//
// At https://account.stellaurator.com/console a Members-only Wix page frames this screen at
// https://stellaurator.com/console/?in=wix. Wix asks for the sign-in; the page passes each request to
// backend/consoleView.web.js, which checks the owner on the server on every call. So in this mode there
// is no link code, no device key, no passphrase box and no Devices page: `office` calls go through the
// page instead of signed fetches, and the answers have exactly the shape consoleQuery and
// consoleAction answer, so every page renders unchanged.
//
// THE PASSPHRASE IS SENT ONLY TO A PARENT THAT HAS SPOKEN. `ready` and `query` carry nothing secret
// and go out to any parent, because the Wix page's origin is not known until it answers. A change
// carries the passphrase typed in its confirm step, so it is posted only to the origin of the `hello`
// that came back, and only when that origin is one of WIX_PARENTS. A page that frames this screen
// anywhere else gets the reads it could not answer anyway, and never a passphrase.
//
// It touches no document, so tests/consoleInAccount.test.mjs runs it with a fake window.
import { OfficeError } from './office.js';

/** The account site, and Wix's own host for the frame around an HTML embed. */
export const WIX_PARENTS = ['https://account.stellaurator.com'];
export const WIX_WRAPPER = /^https:\/\/[a-z0-9-]+\.filesusr\.com$/;

export const ACCOUNT_CONSOLE = 'https://account.stellaurator.com/console';
export const TIMEOUT_MS = 30000;

/** Wix mode: `?in=wix` AND actually framed. The parameter alone, in a tab of its own, is ignored. */
export function isWixMode(search, framed) {
  let q = null;
  try { q = new URLSearchParams(String(search || '')); } catch { return false; }
  return q.get('in') === 'wix' && framed === true;
}

/** May this origin receive a change (and so the passphrase)? */
export const allowedParent = (origin) => WIX_PARENTS.includes(String(origin || '')) || WIX_WRAPPER.test(String(origin || ''));

/**
 * The bridge. `post(msg, targetOrigin)` sends to the parent; `listen(fn)` subscribes to its messages
 * (fn gets { data, origin }). `onHello` hears who is signed in. -> { ready, query, action, signout }.
 */
export function makeBridge({ post, listen, onHello, timeoutMs = TIMEOUT_MS, now = () => Date.now() } = {}) {
  let parentOrigin = '';      // set by the first `hello` from an allowed origin
  let next = 1;
  const waiting = new Map();   // id -> { resolve, reject, timer }

  listen((event) => {
    const d = event && event.data;
    if (!d || typeof d !== 'object') return;
    const origin = String((event && event.origin) || '');
    if (!allowedParent(origin)) return;
    if (d.t === 'hello') {
      parentOrigin = origin;
      if (onHello) onHello({ owner: d.owner === true, name: String(d.name || '') });
      return;
    }
    if (d.t === 'answer' && waiting.has(d.id)) {
      const w = waiting.get(d.id);
      waiting.delete(d.id);
      clearTimeout(w.timer);
      const a = d.answer;
      if (!a || typeof a.ok !== 'boolean') { w.reject(new OfficeError('The account site answered something unexpected. Reload the page.', { reason: 'unexpected' })); return; }
      if (!a.ok) { w.reject(new OfficeError(a.error || 'The account site refused.', a)); return; }
      w.resolve(a);
    }
  });

  function ask(msg, target) {
    const id = `c${now()}-${next++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(new OfficeError('The account site did not answer in 30 seconds. Reload the page and try again.', { reason: 'offline' }));
      }, timeoutMs);
      waiting.set(id, { resolve, reject, timer });
      post({ ...msg, id }, target);
    });
  }

  return {
    ready: () => post({ t: 'ready' }, '*'),
    signout: () => post({ t: 'signout' }, parentOrigin || '*'),
    /** One read section. Nothing secret travels, so it may go before the parent has said hello. */
    query: (p = {}) => ask({
      t: 'query',
      section: String(p.section || ''),
      range: String(p.range || ''),
      latestVersion: String(p.latestVersion || ''),
      ...(p.days ? { days: p.days } : {}),
      ...(p.snapshot ? { snapshot: p.snapshot } : {}),
    }, parentOrigin || '*'),
    /** One change, with the passphrase typed for it. Only ever to the parent that said hello. */
    action: (payload, passphrase) => {
      if (!parentOrigin) return Promise.reject(new OfficeError('The account site has not answered yet. Reload the page.', { reason: 'offline' }));
      return ask({ t: 'action', payload: payload || {}, passphrase: String(passphrase || '') }, parentOrigin);
    },
    get parentOrigin() { return parentOrigin; },
  };
}
