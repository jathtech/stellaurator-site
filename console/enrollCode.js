// Reading a link code out of whatever the owner pastes (docs/OWNER_CONSOLE.md, console-app/README.md).
//
// A code reaches a new Console device in one of three shapes, and the first-run screen takes all
// of them:
//
//   LINK-7K2M-9QXD                                          the code as another device shows it
//   https://stellaurator.com/console/#enroll=LINK-7K2M-9QXD  the link under the QR square
//   #enroll=LINK-7K2M-9QXD                                  the fragment alone
//
// and a code the owner made by hand in the Wix CMS (CONSOLE_ENROLL_CODE), which may be any run of
// letters and digits. Case, spaces and dashes never matter: the back office compares the hash of
// the letters and digits alone (consoleAuthLogic.js normEnrollCode), so this does the same.
//
// It touches no document and no storage, so console-app/tests runs it under Node.

export const MIN_CODE = 8;
export const MAX_CODE = 64;

/** Letters and digits only, upper case: exactly what the back office hashes. */
export const normCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** LINK7K2M9QXD -> LINK-7K2M-9QXD; anything else back as typed, upper case. */
export function showCode(code) {
  const n = normCode(code);
  if (/^LINK[A-Z0-9]{8}$/.test(n)) return `LINK-${n.slice(4, 8)}-${n.slice(8, 12)}`;
  return n;
}

/** The `enroll=` value of a fragment or a whole link, or '' when there is none. */
export function codeFromFragment(text) {
  const m = /(?:^|[#&?])enroll=([^&\s]+)/.exec(String(text || ''));
  if (!m) return '';
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* keep it as it came */ }
  return raw.trim();
}

/**
 * -> { ok:true, code } | { ok:false, error }
 * `code` is in the form the back office takes (consoleEnrollFinish normalizes it again).
 */
export function readCode(input) {
  const text = String(input || '').trim();
  if (!text) return { ok: false, error: 'Type or paste the link code first.' };
  const fromLink = codeFromFragment(text);
  const raw = fromLink || (/^https?:\/\//i.test(text) ? '' : text);
  if (!raw) return { ok: false, error: 'That link has no code in it. Copy the whole link, with the part after the # sign.' };
  const n = normCode(raw);
  if (n.length < MIN_CODE) return { ok: false, error: `That is shorter than ${MIN_CODE} letters and digits, so it is not a link code.` };
  if (n.length > MAX_CODE) return { ok: false, error: 'That is too long to be a link code.' };
  return { ok: true, code: showCode(n) };
}
