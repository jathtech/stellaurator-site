// The Console's half of the signature — docs/OWNER_CONSOLE.md.
//
// This device has no password to send and no lease to hold. What it has is a key pair made here,
// in this browser, whose private half is marked **non-extractable**: WebCrypto will sign with it
// and will not hand it back, not to this page, not to a script injected into this page, not to
// anybody reading the phone's storage. Every request carries a signature over the canonical string
// below, so a request cannot be re-used, re-timed or claimed by another device.
//
// Everything here is the mirror of site/wix/consoleAuthLogic.js, and it is not trusted to stay the
// mirror: tests/consoleAuth.test.mjs runs THIS file under Node's webcrypto, signs with it, and
// verifies with the back office's own verifier over the back office's own canonical string. If the
// two ever drift by one newline, that test fails rather than the owner's phone.
//
// It touches no document and no storage, so it can be imported anywhere.

/** The same self-naming prefix the back office expects. Changing it invalidates every device. */
export const CANONICAL_PREFIX = 'STELLA-CONSOLE-v1';
export const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
export const SIGN_ALGORITHM = { name: 'ECDSA', hash: { name: 'SHA-256' } };
export const DEVICE_ID_HEX = 32;

const subtle = () => {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('This browser has no WebCrypto, so it cannot be a Console device. Use a current browser over https.');
  return c.subtle;
};

const bytes = (text) => new TextEncoder().encode(String(text));

export const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function toBase64Url(buffer) {
  const raw = [...new Uint8Array(buffer)].map((b) => String.fromCharCode(b)).join('');
  const b64 = typeof btoa === 'function' ? btoa(raw) : Buffer.from(new Uint8Array(buffer)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text) {
  return toHex(await subtle().digest('SHA-256', bytes(text)));
}

/** Character for character what backend/consoleAuthLogic.js `canonicalString` builds. */
export function canonicalString({ deviceId, ts, nonce, payloadHash }) {
  return [
    CANONICAL_PREFIX,
    String(deviceId || ''),
    String(Math.trunc(Number(ts) || 0)),
    String(nonce || ''),
    String(payloadHash || ''),
  ].join('\n');
}

/** 16 random bytes from the browser's own generator, as hex. */
export function newNonce() {
  const out = new Uint8Array(16);
  globalThis.crypto.getRandomValues(out);
  return toHex(out);
}

/**
 * A fresh pair. `extractable: false` on the private half is the whole point of using WebCrypto
 * here rather than storing a secret: the key can be USED by this origin and cannot be read out of
 * it, so a copy of the phone's IndexedDB is not a copy of the Console.
 */
export async function generateKeyPair() {
  return subtle().generateKey(KEY_ALGORITHM, false, ['sign', 'verify']);
}

export async function publicJwk(publicKey) {
  const jwk = await subtle().exportKey('jwk', publicKey);
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

/** A device id names its key: sha256(x.y), first 16 bytes. Both sides work it out the same way. */
export async function deviceIdFor(jwk) {
  const hash = await sha256Hex(`${(jwk && jwk.x) || ''}.${(jwk && jwk.y) || ''}`);
  return hash.slice(0, DEVICE_ID_HEX);
}

/**
 * One signed request body.
 *
 * `payload` is serialized ONCE, here, and the string is what is hashed, what is signed and what is
 * sent. That is deliberate: if the object travelled and each side re-serialized it, two JSON
 * writers disagreeing about key order or number formatting would be a signature failure nobody
 * could debug from a phone.
 *
 * -> { deviceId, ts, nonce, payload, sig }
 */
export async function signRequest(privateKey, { deviceId, payload, now = Date.now(), nonce = null }) {
  const json = JSON.stringify(payload == null ? {} : payload);
  const ts = Math.trunc(Number(now) || Date.now());
  const use = nonce || newNonce();
  const payloadHash = await sha256Hex(json);
  const canonical = canonicalString({ deviceId, ts, nonce: use, payloadHash });
  const sig = await subtle().sign(SIGN_ALGORITHM, privateKey, bytes(canonical));
  return { deviceId, ts, nonce: use, payload: json, sig: toBase64Url(sig) };
}
