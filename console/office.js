// Where the Console's back office is, and the one seam that may point it somewhere else.
//
// The Console talks to exactly one thing: the Wix site's http-functions. No third party, no
// analytics, no CDN call of its own. Four functions, and this file is the only place their
// addresses are written down.
//
// **The seam.** A browser proof cannot reach the real back office (it would need the owner's
// passphrase and would write to the live ledger), so `?office=` may point this at a fake. It is
// honored ONLY when the page itself is being served from a loopback address. That direction is the
// whole safety of it: on https://stellaurator.com the parameter is read and thrown away, so a link
// with `?office=https://somewhere.else` cannot turn somebody's Console into a phishing page - which
// is exactly what a seam gated on "not production" would have allowed.
//
// It touches no document, so tests/consoleAuth.test.mjs runs `officeBase` over a table of origins.

export const DEFAULT_OFFICE = 'https://account.stellaurator.com/_functions';
export const LOOPBACK = ['localhost', '127.0.0.1', '[::1]', '::1'];

/** The four functions the Console calls, and the whole list. */
export const FUNCTIONS = ['consoleEnrollFinish', 'consoleQuery', 'consoleAction'];

export const isLoopback = (hostname) => LOOPBACK.includes(String(hostname || '').toLowerCase());

/**
 * -> { base, overridden } for a page at `href`.
 * An override has to be http(s) and has to be loopback itself: a local page pointed at a remote
 * address would be the same hole by another road.
 */
export function officeBase(href, fallback = DEFAULT_OFFICE) {
  let url = null;
  try { url = new URL(String(href || '')); } catch { return { base: fallback, overridden: false }; }
  const asked = (url.searchParams.get('office') || '').trim();
  if (!asked) return { base: fallback, overridden: false };
  if (!isLoopback(url.hostname)) return { base: fallback, overridden: false, ignored: asked };
  let at = null;
  try { at = new URL(asked); } catch { return { base: fallback, overridden: false, ignored: asked }; }
  if (!/^https?:$/.test(at.protocol) || !isLoopback(at.hostname)) return { base: fallback, overridden: false, ignored: asked };
  return { base: at.href.replace(/\/+$/, ''), overridden: true };
}

/** Anything that is not the service's own answer is a message the owner can act on. */
export class OfficeError extends Error {
  constructor(message, data) {
    super(message);
    this.name = 'OfficeError';
    this.data = data || {};
    this.reason = (data && data.reason) || 'refused';
  }
}

const TIMEOUT_MS = 25000;

/**
 * POST JSON to one function and answer its JSON. Every answer of the service carries a boolean
 * `ok`; anything else is a host speaking for it (a Wix error page, a captive portal) and is not
 * treated as a refusal.
 */
export async function call(base, fn, body, { timeoutMs = TIMEOUT_MS } = {}) {
  let res;
  try {
    res = await fetch(`${base}/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new OfficeError(`The back office could not be reached (${String((e && e.message) || e).slice(0, 80)}). Check the connection and try again.`, { reason: 'offline' });
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!json || typeof json.ok !== 'boolean') {
    throw new OfficeError(`The back office answered something unexpected (${res.status}). It may be mid-publish - try again in a moment.`, { reason: 'unexpected' });
  }
  if (!json.ok) throw new OfficeError(json.error || 'The back office refused.', json);
  return json;
}
