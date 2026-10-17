// The StellAurator Console: the whole app.
//
// (docs/OWNER_CONSOLE.md. Owner, 2026-09-20: "an extremely lightweight standalone business control
// type app with metrics and stuff like that … without opening the actual app itself." The owner is
// often away from the PC and works from a phone, so this is a phone screen first and a desktop
// window second.)
//
// It is a page. Installing it ("Add to Home Screen") gives it an icon and a window of its own, and
// changes nothing else - there is no second installer, no second code signature and no update
// channel to manage, because a reload IS the update.
//
// Three things it holds, and they are the whole design:
//
//   1. **A key, not a password.** This device signed itself up once, from a link code another
//      linked device showed (Devices, "Link another device") or one the owner made by hand in the
//      Wix CMS. Its private key is non-extractable and lives in IndexedDB; every request is signed.
//      Losing the phone costs an Unlink, not a password change.
//   2. **A passphrase this page never stores.** The Gold desk passphrase is typed once per sitting
//      and lives in one variable below. Fifteen idle minutes clears it. Five minutes with the app
//      hidden clears it - a phone put in a pocket is a phone somebody else may pick up. It is never
//      in localStorage, never in IndexedDB, never in a URL and never in a log line.
//      THE ONE EXCEPTION is the desktop program (console-app/, owner 2026-10-10: "a standalone app
//      that I do not need to log into"): there the device key and the accepted passphrase are kept
//      with Windows' own encryption through `window.secrets` (appSecrets.js), the stored passphrase
//      is read BEFORE the box is drawn, and the Windows account is the lock.
//   3. **Numbers it can explain.** Every panel names its source; every figure that does not exist
//      says "not collected" rather than showing a zero.
//
// WIX MODE (owner 2026-10-14: "I don't want it to require that", the link code). Framed by the
// Members-only page https://account.stellaurator.com/console at `?in=wix`, this screen has no link
// code, no device key, no passphrase box and no Devices page: Wix asks for the sign-in, and every
// request goes through the page (wixFrame.js) to backend/consoleView.web.js, which checks the owner
// on the server every time. Reading needs nothing more; a change on Account control asks for the Gold
// desk passphrase in its confirm step, and the typed value is dropped after that one call.
import { officeBase, call, OfficeError } from './office.js';
import { generateKeyPair, publicJwk, deviceIdFor, signRequest } from './sign.js';
import { readDevice, saveDevice, forgetDevice, readReadings, saveReadings, readPrefs, savePrefs } from './store.js';
import { fetchReleases, releaseTotals, latestRelease, addSnapshot, totalsOf, kindTotals, splitPerRelease, downloadSplit, RELEASES_PAGE } from './releases.js';
import { buildReport, toText, toCsv, csvFilename, show as showValue, NOT_COLLECTED } from './reports.js';
import { el, panel, grid, table } from './charts.js';
import { renderSection } from './sections.js';
import { renderActions } from './actions.js';
import { inApp, storedPassphrase, keepPassphrase, forgetPassphrase } from './appSecrets.js';
import { readCode, codeFromFragment } from './enrollCode.js';
import { toSvg } from './qr.js';
import { isWixMode, makeBridge, ACCOUNT_CONSOLE } from './wixFrame.js';

const MIN_PASS = 12;
const IDLE_MS = 15 * 60 * 1000;
const HIDDEN_MS = 5 * 60 * 1000;

const PAGES = [
  ['overview', 'Overview', 'Accounts, the trial, plans, and the computers in the field.'],
  ['marketing', 'Marketing', 'Facebook ads, website button presses, the waitlist, and the path from ad click to paid plan.'],
  ['downloads', 'Downloads', 'Installer downloads per release, and who is on the newest version.'],
  ['licenses', 'Licenses', 'Gold licenses, invitation-key batches, computers per account.'],
  ['collaboration', 'Sharing', 'Invitations made, opened and accepted. No content, ever.'],
  ['support', 'Support', 'Bug reports and messages, with what people wrote.'],
  ['alpha', 'Alpha', 'The public alpha: testers, sessions, hours, what they used, words recorded. Counts only.'],
  ['usage', 'Usage', 'From the installs that opted in: controls pressed, tools run, failures, sessions. Counts only.'],
  ['audit', 'Audit', 'The ledger: every action, every refusal, every device.'],
  ['test', 'Test', 'Your own activity and Claude\'s, kept out of every other page.'],
  ['reports', 'Reports', 'This week and this month, to copy, download or print.'],
  ['actions', 'Control', 'One account at a time. Every change confirmed and recorded.'],
  ['devices', 'Devices', 'The phones and computers this Console is linked to.'],
];
/** Framed by the account site's Console page (wixFrame.js). Decided once, before anything is drawn. */
const WIX = typeof window !== 'undefined' && isWixMode(window.location.search, window.parent !== window);
/** Wix mode has no Devices page: devices are linked and unlinked from a linked device. */
const pagesHere = () => (WIX ? PAGES.filter(([id]) => id !== 'devices') : PAGES);
let bridge = null;

const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['365d', 'A year']];

// ---- the one variable that holds the passphrase ------------------------------------------------
//
// Not exported, not written anywhere, and dropped by `lock()`. Everything else in this file reads
// it through `secret`, so there is exactly one place to look when asking "where does it live".
let secret = '';
const locked = () => !secret;

const state = {
  device: null,
  problem: '',          // what went wrong while linking, shown on the unlinked screen
  page: 'overview',
  range: '30d',
  answers: {},          // 'overview:30d' -> envelope
  downloads: null,      // the GitHub half, kept for the session
  busy: false,
  actionState: {},
  keepPass: true,       // the desktop program: keep an accepted passphrase on this computer
  hasStoredPass: false, // the desktop program: a passphrase is kept, so the gate is one press
  linkCode: null,       // Devices, "Link another device": { code, url, expiresAt } while it lasts
  wix: { known: false, owner: false, name: '' }, // Wix mode: what the page said in `hello`
};

let idleAt = Date.now();
let hiddenSince = 0;
let ticker = null;

const dom = {};
const office = officeBase(typeof window === 'undefined' ? '' : window.location.href);

const touch = () => { idleAt = Date.now(); };

function lock(why) {
  secret = '';
  state.answers = {};
  draw();
  if (why) say(why);
}

function say(text, tone) {
  dom.says.textContent = '';
  if (text) dom.says.appendChild(el('p', { class: `said-line${tone ? ` is-${tone}` : ''}`, text }));
}

// ---- talking to the back office ------------------------------------------------------------------

/** One signed request. The passphrase rides inside the signed payload, never beside it. */
async function signed(fn, payload) {
  if (!state.device) throw new OfficeError('This device is not linked to the Console yet.', { reason: 'unlinked' });
  touch();
  const body = await signRequest(state.device.privateKey, {
    deviceId: state.device.deviceId,
    payload: { ...payload, passphrase: secret },
  });
  try {
    return await call(office.base, fn, body);
  } catch (e) {
    // A refusal at the passphrase takes the passphrase away, exactly as the Gold desk does it: the
    // next thing on screen is the box to type it into, not a page of stale numbers.
    const reason = (e && e.reason) || '';
    if (reason === 'locked' || reason.startsWith('passphrase')) {
      secret = '';
      state.answers = {};      // never leave a page of numbers behind a shut door
      // a kept passphrase that the desk refuses (it was changed) is no use: forget it, ask again
      if (reason.startsWith('passphrase') && state.hasStoredPass) {
        await forgetPassphrase();
        state.hasStoredPass = false;
      }
    }
    if (reason === 'revoked') {
      await forgetDevice();
      state.device = null;
      secret = '';
      state.answers = {};
    }
    throw e;
  }
}

// In Wix mode the page carries both, and the passphrase (a change only) is the one typed for it.
const query = (payload) => (WIX ? bridge.query(payload) : signed('consoleQuery', payload));
const action = (name, extra, pass) => (WIX ? bridge.action({ action: name, ...extra }, pass) : signed('consoleAction', { action: name, ...extra }));

/**
 * Wix mode: ask for the Gold desk passphrase for one change, in the message area. -> the typed value,
 * or '' when Cancel is pressed. The box is emptied the moment it is read; nothing keeps the value.
 */
function askPassphrase(what) {
  return new Promise((resolve) => {
    const box = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', maxlength: '200', placeholder: 'Your Gold desk passphrase', 'aria-label': 'Your Gold desk passphrase', dataset: { consoleActionPass: 'yes' } });
    const done = (value) => { box.value = ''; dom.says.textContent = ''; resolve(value); };
    dom.says.textContent = '';
    dom.says.appendChild(el(
      'form',
      { class: 'row', dataset: { consoleAskPass: 'yes' }, onsubmit: (e) => { e.preventDefault(); if (box.value.length < MIN_PASS) { box.focus(); return; } done(box.value); } },
      el('span', { class: 'note', text: `${what} Type your Gold desk passphrase and press Continue.` }),
      box,
      el('button', { class: 'btn btn-gold', type: 'submit', text: 'Continue' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Cancel', onclick: () => done('') }),
    ));
    box.focus();
  });
}

// ---- the GitHub half -------------------------------------------------------------------------------
//
// Asked by this device, not by the back office. GitHub gives running totals only, so today's reading
// is written down (here and, once a day, on the back office) and the per-day line is the difference.
// The readings are kept with it: the Downloads and Test pages start their subtraction from one of
// them (site/wix/README.md §14, releases.js downloadSplit).

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

async function readGithub() {
  const got = await fetchReleases();
  const assets = releaseTotals(got.releases);
  const latest = latestRelease(got.releases);
  let saved = await readReadings();
  if (assets.length) {
    saved = addSnapshot(saved, { at: new Date().toISOString(), totals: totalsOf(assets) });
    await saveReadings(saved);
  }
  state.downloads = {
    assets,
    latest,
    readings: saved,
    kinds: kindTotals(assets),
    perRelease: splitPerRelease(assets),
    releasesPage: RELEASES_PAGE,
    error: got.error || '',
  };
  return state.downloads;
}

// ---- loading a page ---------------------------------------------------------------------------------

/**
 * One page of numbers. `force` skips what is already in hand.
 *
 * It is not an optimization that the passphrase gate passes `force`. A cached answer would satisfy
 * the gate WITHOUT the back office ever being asked, which means any passphrase at all would open a
 * Console that had been locked with numbers still in memory - somebody picking up an unattended
 * phone would type anything and read the business. (Found by the browser proof, which locked a
 * device and then typed nonsense.) So: a sitting begins with a real request, always.
 */
async function load(page, range, { force = false } = {}) {
  if (page === 'reports' || page === 'actions') return null;
  const key = `${page}:${range}`;
  if (!force && state.answers[key]) return state.answers[key];
  state.busy = true;
  draw();
  try {
    let extra = {};
    if (page === 'downloads') {
      const dl = await readGithub();
      extra = {
        latestVersion: dl.latest.version || '',
        days: RANGE_DAYS[range] || 30,
        // one small row a day on the back office, so the series survives a new phone. The total is
        // installers alone: update checks and blockmaps are not downloads (releases.js)
        snapshot: { downloadsTotal: dl.kinds.installers, perRelease: totalsOf(dl.assets) },
      };
    }
    // The Test page shows what GitHub had counted before the baseline, so it reads GitHub too.
    if (page === 'test' && !state.downloads) { try { await readGithub(); } catch { /* GitHub is allowed to be down */ } }
    // The Marketing page shows other people's installer downloads beside the funnel, from GitHub too.
    if (page === 'marketing' && !state.downloads) { try { await readGithub(); } catch { /* GitHub is allowed to be down */ } }
    const answer = await query({ section: page, range, ...extra });
    state.answers[key] = answer;
    say('');
    return answer;
  } catch (e) {
    say(e.message, 'alarm');
    return null;
  } finally {
    state.busy = false;
    draw();
  }
}

// ---- enrollment --------------------------------------------------------------------------------------

/** `#enroll=LINK-XXXX-XXXX`: the code another device showed, in the fragment, so no server saw it. */
function enrollCodeFromUrl() {
  return codeFromFragment(window.location.hash || '').toUpperCase();
}

/** A name for this device that means something in a list: "iPhone · Safari", "Windows · Edge". */
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'A device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  return `${system} · ${browser}`;
}

/**
 * Take the code out of the address bar, link, and say what happened. Called on load AND on
 * `hashchange`, because tapping the link while the Console is already open changes only the
 * fragment - which is not a page load, so nothing would run at all without this. (Found by the
 * browser proof: the second visit sat on the passphrase box having quietly linked nothing.)
 */
async function linkWith(code) {
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* not fatal */ }
  draw();
  try {
    await enroll(code);
    state.problem = '';
    say('This device is linked. Type your Gold desk passphrase to open the Console.', 'ok');
  } catch (e) {
    state.problem = e.message;
    say(e.message, 'alarm');
  }
  draw();
}

async function enroll(code) {
  say('Linking this device…');
  // The desktop program keeps the key with Windows' encryption, which needs it exportable once;
  // a browser keeps it non-extractable in IndexedDB (store.js).
  const pair = await generateKeyPair({ extractable: inApp() });
  const jwk = await publicJwk(pair.publicKey);
  const deviceId = await deviceIdFor(jwk);
  const label = inApp() ? `${deviceLabel().split(' · ')[0]} · Console app` : deviceLabel();
  const r = await call(office.base, 'consoleEnrollFinish', { code, publicKeyJwk: jwk, deviceLabel: label });
  const device = await saveDevice({ deviceId: r.deviceId || deviceId, label: r.label || label, linkedAt: new Date().toISOString(), publicJwk: jwk, privateKey: pair.privateKey });
  state.device = device;
  return device;
}

// ---- the screens ---------------------------------------------------------------------------------------

function unlinkedScreen(problem) {
  const box = el('input', {
    class: 'input', type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: '400',
    placeholder: 'LINK-XXXX-XXXX, or the whole link',
    title: 'The link code another Console device showed, or the code you made in the Wix CMS. The whole link works too.',
    dataset: { consoleCode: 'yes' },
  });
  const go = el('button', {
    class: 'btn btn-gold', type: 'submit', text: 'Link this device',
    title: 'Send this device\'s public key with the code. The code works once.',
    dataset: { consoleLinkWithCode: 'yes' },
  });
  const form = el(
    'form',
    {
      dataset: { consoleFirstRun: 'yes' },
      onsubmit: async (e) => {
        e.preventDefault();
        const got = readCode(box.value);
        if (!got.ok) { say(got.error, 'alarm'); return; }
        go.disabled = true;
        go.textContent = 'Linking…';
        await linkWith(got.code);
        if (state.device) { box.value = ''; await openWithStored(); }
        go.disabled = false;
        go.textContent = 'Link this device';
      },
    },
    el('p', { class: 'lede', text: 'Link code' }),
    el('div', { class: 'row' }, box, go),
  );
  return el(
    'div',
    { class: 'section', dataset: { consoleScreen: 'unlinked' } },
    panel(
      { title: inApp() ? 'This computer is not linked yet' : 'This device is not linked yet', wide: true },
      problem ? el('p', { class: 'said-line is-alarm', text: problem }) : null,
      // The owner, 2026-10-14: no link code. The account site opens the Console with the normal sign-in;
      // the link code below stays for the desktop program and linked phones.
      inApp() ? null : el('div', { class: 'block', dataset: { consoleInAccount: 'yes' } },
        el('p', {}, el('a', {
          class: 'btn btn-gold', href: ACCOUNT_CONSOLE, text: 'Open the Console in your account',
          title: 'Open the Console on account.stellaurator.com. Sign in there with your StellAurator account.',
          dataset: { consoleOpenInAccount: 'yes' },
        })),
        el('p', { class: 'note', text: 'Sign in with your StellAurator account. No link code needed.' }),
      ),
      el('p', { text: 'The Console shows the business behind StellAurator: accounts, downloads, licenses, what people wrote in, and the controls that go with them. It is linked once, with a link code, and then this device signs everything it asks for with a key only it holds.' }),
      form,
      el('p', { class: 'note', text: 'Where a code comes from:' }),
      el('ol', { class: 'steps' },
        el('li', {}, 'On a Console device that is already linked, open ', el('strong', { text: 'Devices' }), ' and press ', el('strong', { text: 'Link another device' }), '. Type its code here, or scan its square with this device\'s camera.'),
        el('li', {}, 'No device linked at all? Make a code by hand in the Wix CMS: a ', el('strong', { text: 'CONSOLE_ENROLL_CODE' }), ' row in Config, made with console-app/scripts/hash-code.mjs (console-app/README.md).'),
      ),
      el('p', { class: 'note', text: 'A code works once. One from another device lasts ten minutes. In a link, the code is in the part after the # sign, which browsers do not send to any server.' }),
    ),
  );
}

/**
 * The desktop program opens with the kept passphrase, read from Windows' store BEFORE any box is
 * drawn. -> true when the Console opened. A browser has nothing kept and answers false at once.
 */
async function openWithStored() {
  if (!state.device || !locked()) return false;
  const kept = await storedPassphrase();
  state.hasStoredPass = !!kept;
  if (!kept) { draw(); return false; }
  secret = kept;
  state.answers = {};
  const answer = await load('overview', state.range, { force: true });
  if (!answer) { secret = ''; draw(); return false; }
  touch();
  draw();
  return true;
}

/** Wix mode, before the page has said who is signed in, and after it said it is not the owner. */
function wixScreen() {
  if (!state.wix.known) {
    return el('div', { class: 'section', dataset: { consoleScreen: 'wix-wait' } }, el('p', { class: 'note', text: 'Checking who is signed in.' }));
  }
  return el('div', { class: 'section', dataset: { consoleScreen: 'not-owner' } }, panel(
    { title: 'Not the owner\'s account', wide: true },
    el('p', { text: 'This account is not the owner\'s. Sign in with the owner\'s account to see the Console.' }),
    el('p', {}, el('button', { class: 'btn btn-quiet', type: 'button', text: 'Sign out', dataset: { consoleSignOut: 'yes' }, onclick: () => bridge && bridge.signout() })),
  ));
}

function gateScreen() {
  if (state.hasStoredPass) {
    // The desktop program with a kept passphrase: one press, nothing to type.
    const open = el('button', {
      class: 'btn btn-gold', type: 'button', text: 'Open the Console',
      title: 'Open with the passphrase kept on this computer',
      dataset: { consoleUnlock: 'yes' },
      onclick: async () => { open.disabled = true; open.textContent = 'Opening…'; await openWithStored(); },
    });
    return el('div', { class: 'section', dataset: { consoleScreen: 'gate' } }, panel(
      { title: 'Locked', wide: true },
      el('div', { class: 'row' }, open),
      el('p', { class: 'note', text: 'Your Gold desk passphrase is kept on this computer, encrypted by your Windows account, so nothing has to be typed. Devices has "Forget the passphrase on this computer".' }),
    ));
  }
  const box = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', inputmode: 'text', placeholder: 'Your Gold desk passphrase', title: 'The same passphrase as the Gold desk', dataset: { consolePass: 'yes' }, maxlength: '200' });
  const go = el('button', { class: 'btn btn-gold', type: 'submit', title: 'Check the passphrase on the back office and open the Console', dataset: { consoleUnlock: 'yes' }, text: 'Open the Console' });
  const keep = inApp()
    ? el('label', { class: 'note', title: 'Keep the passphrase on this computer, encrypted by your Windows account, so the Console opens without it next time' },
      el('input', { type: 'checkbox', checked: state.keepPass, dataset: { consoleKeepPass: 'yes' }, onchange: (e) => { state.keepPass = !!e.target.checked; } }),
      ' Keep it on this computer')
    : null;
  const form = el(
    'form',
    {
      dataset: { consoleGate: 'yes' },
      onsubmit: async (e) => {
        e.preventDefault();
        if (box.value.length < MIN_PASS) { say(`That is shorter than ${MIN_PASS} characters, so it is not the passphrase.`, 'alarm'); return; }
        go.disabled = true;
        go.textContent = 'Opening…';
        secret = box.value;
        state.answers = {};
        const answer = await load('overview', state.range, { force: true });
        go.disabled = false;
        go.textContent = 'Open the Console';
        if (!answer) { secret = ''; draw(); return; }
        // kept only AFTER the back office accepted it, and only in the desktop program
        if (inApp() && state.keepPass) state.hasStoredPass = await keepPassphrase(secret);
        box.value = '';
        touch();
        draw();
      },
    },
    el('p', { class: 'lede', text: 'Your Gold desk passphrase' }),
    el('div', { class: 'row' }, box, go),
    keep,
    el('p', { class: 'note', text: inApp()
      ? 'The same passphrase as the Gold desk, checked on the back office. Kept on this computer, it is encrypted by your Windows account and the Console opens without it; anyone signed in to this Windows account can then open the Console.'
      : 'The same passphrase as the Gold desk, checked on the back office and never on this device. It is asked once per sitting, forgotten after fifteen idle minutes, and forgotten again if this app is left in the background for five.' }),
  );
  return el('div', { class: 'section', dataset: { consoleScreen: 'gate' } }, panel({ title: 'Locked', wide: true }, form));
}

// ---- Reports ----------------------------------------------------------------------------------------------

function reportsScreen() {
  const holder = el('div', { dataset: { reportHolder: 'yes' } });
  const make = async (kind) => {
    say('Reading what the report needs…');
    // a report is the sections summed, so it fetches whatever it has not got rather than new numbers
    for (const page of ['overview', 'collaboration', 'support', 'downloads']) await load(page, state.range);
    const dlAnswer = state.answers[`downloads:${state.range}`];
    const report = buildReport(kind, {
      overview: state.answers[`overview:${state.range}`],
      collaboration: state.answers[`collaboration:${state.range}`],
      support: state.answers[`support:${state.range}`],
      // other people only (site/wix/README.md §14): the owner's and Claude's own are on the Test page
      downloads: state.downloads && dlAnswer
        ? downloadSplit({ github: state.downloads, test: (dlAnswer.data || {}).test, days: 30 })
        : null,
    });
    holder.textContent = '';
    holder.appendChild(drawReport(report));
    say('');
  };
  return el(
    'div',
    { class: 'section', dataset: { consoleSection: 'reports' } },
    grid(panel(
      { title: 'Reports', note: 'The same numbers as the pages, summed over a window, in an order you can read out loud. Built here - nothing extra is asked of the back office.', wide: true },
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn btn-gold', type: 'button', dataset: { report: 'week' }, text: 'This week', onclick: () => make('week') }),
        el('button', { class: 'btn btn-gold', type: 'button', dataset: { report: 'month' }, text: 'This month', onclick: () => make('month') }),
      ),
      el('p', { class: 'note', text: 'A window is the last 7 or 30 days ending today, in UTC - not a calendar week. The rows carry instants and you travel; a week that moved with you could not be compared with last week\'s.' }),
    )),
    holder,
  );
}

function drawReport(report) {
  const csv = () => {
    const blob = new Blob([toCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: csvFilename(report) });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(toText(report)); say('Copied.', 'ok'); }
    catch { say('This browser would not let the page copy. The report is on screen to select.', 'alarm'); }
  };
  return el(
    'div',
    { dataset: { report: report.window.kind } },
    grid(panel(
      { title: report.title, note: report.subtitle, wide: true },
      el(
        'div',
        { class: 'row no-print' },
        el('button', { class: 'btn btn-quiet', type: 'button', dataset: { reportCopy: 'yes' }, text: 'Copy as text', onclick: copy }),
        el('button', { class: 'btn btn-quiet', type: 'button', dataset: { reportCsv: 'yes' }, text: 'Download CSV', onclick: csv }),
        el('button', { class: 'btn btn-quiet', type: 'button', dataset: { reportPrint: 'yes' }, text: 'Print', onclick: () => window.print() }),
      ),
      report.groups.map((g) => el(
        'div',
        { class: 'block', dataset: { reportGroup: g.group } },
        el('h3', { text: g.group }),
        table(g.rows.map((r) => ({
          dataset: { reportRow: r.label },
          cells: [r.label, { text: showValue(r.value), class: r.value == null ? 'dim' : 'strong mono' }, { text: r.note, class: 'dim' }],
        }))),
      )),
      el('p', { class: 'note', text: `"${NOT_COLLECTED}" means nobody has that number - it is never a zero pretending to be one.` }),
    )),
  );
}

// ---- Devices ---------------------------------------------------------------------------------------------

/** The Alpha page's "Grant the free year": confirmed on the page, checked again by the back office. */
async function reward(tester) {
  try {
    const pass = WIX ? await askPassphrase(`Grant the free year to ${tester.email || 'this tester'}?`) : '';
    if (WIX && !pass) { draw(); return; }
    const r = await action('alpha:reward', { memberId: tester.memberId, confirm: true }, pass);
    say(r.said || (r.ok ? 'The free year is granted.' : r.error || 'That did not work.'), r.ok ? '' : 'alarm');
    await load('alpha', state.range, { force: true });
  } catch (e) {
    say(e.message, 'alarm');
  }
  draw();
}

async function unlink(device) {
  try {
    const r = await action('device:revoke', { deviceId: device.deviceId, confirm: true });
    if (device.thisDevice) {
      await forgetDevice();
      state.device = null;
      secret = '';
      draw();
      state.hasStoredPass = false;
      say('This device is unlinked. It can do nothing here until it is linked again with a fresh link code.', 'ok');
      return;
    }
    state.answers['devices:' + state.range] = { ok: true, section: 'devices', data: r, sources: ['The ConsoleDevices collection'], notCollected: [] };
    draw();
    say(`${device.label || 'That device'} is unlinked.`, 'ok');
  } catch (e) {
    say(e.message, 'alarm');
  }
}

/** Devices, "Link another device": a signed request plus the passphrase mints a one-time code. */
async function linkAnother() {
  say('Asking the back office for a link code…');
  try {
    const r = await signed('consoleEnrollStartFromDevice', { section: 'devices', intent: 'link-another-device' });
    state.linkCode = { code: r.code, url: r.url || '', expiresAt: r.expiresAt || null };
    say('');
  } catch (e) {
    state.linkCode = null;
    say(e.message, 'alarm');
  }
  draw();
}

async function forgetKept() {
  await forgetPassphrase();
  state.hasStoredPass = false;
  say('The passphrase is no longer kept on this computer. The next sitting asks for it.', 'ok');
  draw();
}

function devicesTools() {
  const c = state.linkCode;
  const until = c && c.expiresAt ? new Date(c.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const square = el('div', { class: 'qr', dataset: { consoleQr: 'yes' } });
  if (c && c.url) {
    // drawn here, from qr.js: no request leaves this device to draw it
    try { square.innerHTML = toSvg(c.url, { scale: 5, title: 'Link code for another Console device' }); } catch { /* the code below still works */ }
  }
  return grid(panel(
    { title: 'Link another device', note: 'A one-time code for a new phone or computer. It lasts ten minutes, works once, and is refused when five devices are linked.', wide: true },
    el('div', { class: 'row' },
      el('button', {
        class: 'btn btn-gold', type: 'button', text: c ? 'Make a new code' : 'Link another device',
        title: 'Make a one-time link code for a new Console device. Your passphrase goes with the request.',
        dataset: { consoleLinkDevice: 'yes' },
        onclick: linkAnother,
      }),
      inApp() ? el('button', {
        class: 'btn btn-quiet', type: 'button', text: 'Forget the passphrase on this computer',
        title: 'Remove the Gold desk passphrase kept on this computer. The next sitting asks for it.',
        dataset: { consoleForgetPassphrase: 'yes' },
        disabled: !state.hasStoredPass,
        onclick: forgetKept,
      }) : null,
    ),
    c ? el('div', { class: 'block', dataset: { consoleLinkCode: c.code } },
      el('p', { class: 'lede mono', text: c.code }),
      square,
      c.url ? el('p', { class: 'note', text: c.url }) : null,
      el('p', { class: 'note', text: `Type the code into the new device's first screen, scan the square, or open the link there.${until ? ` It stops working at ${until}.` : ''}` }),
    ) : null,
  ));
}

// ---- drawing -----------------------------------------------------------------------------------------------

function header() {
  const bar = el('header', { class: 'bar' });
  bar.appendChild(el(
    'div',
    { class: 'bar-top' },
    el('h1', {}, el('span', { class: 'mark', text: 'StellAurator' }), el('span', { class: 'mark-2', text: 'Console' })),
    WIX
      ? (state.wix.known ? el('button', { class: 'btn btn-quiet', type: 'button', dataset: { consoleSignOut: 'yes' }, text: 'Sign out', title: 'Sign out of your StellAurator account and go back to the website', onclick: () => bridge && bridge.signout() }) : null)
      : state.device && !locked()
        ? el('button', { class: 'btn btn-quiet', type: 'button', dataset: { consoleLock: 'yes' }, text: 'Lock', onclick: () => lock('Locked. Type your passphrase to open it again.') })
        : null,
  ));
  if (open()) {
    bar.appendChild(el('nav', { class: 'tabs' }, pagesHere().map(([id, label, blurb]) => el('button', {
      class: `tab${state.page === id ? ' is-on' : ''}`,
      type: 'button',
      title: blurb,
      dataset: { consoleNav: id },
      text: label,
      onclick: () => { touch(); state.page = id; savePrefs({ page: id, range: state.range }); draw(); if (!state.answers[`${id}:${state.range}`]) load(id, state.range).then(draw); },
    }))));
    if (!['reports', 'actions', 'devices'].includes(state.page)) {
      bar.appendChild(el(
        'div',
        { class: 'tabs is-small' },
        el('span', { class: 'note', text: 'Window' }),
        RANGES.map(([id, label]) => el('button', {
          class: `tab${state.range === id ? ' is-on' : ''}`,
          type: 'button',
          dataset: { consoleRange: id },
          text: label,
          onclick: () => { touch(); state.range = id; savePrefs({ page: state.page, range: id }); draw(); load(state.page, id).then(draw); },
        })),
        el('button', {
          class: 'tab',
          type: 'button',
          dataset: { consoleRefresh: 'yes' },
          text: state.busy ? 'Reading…' : 'Read again',
          onclick: () => { touch(); delete state.answers[`${state.page}:${state.range}`]; if (state.page === 'downloads' || state.page === 'test' || state.page === 'marketing') state.downloads = null; draw(); load(state.page, state.range).then(draw); },
        }),
      ));
    }
  }
  return bar;
}

/** Numbers may be shown: a linked device with the passphrase in hand, or Wix mode for the owner. */
const open = () => (WIX ? state.wix.known && state.wix.owner : !!state.device && !locked());

function body() {
  if (WIX && !open()) return wixScreen();
  if (!WIX && !state.device) return unlinkedScreen(state.problem);
  if (!WIX && locked()) return gateScreen();
  if (state.page === 'reports') return reportsScreen();
  if (state.page === 'actions') {
    return renderActions({
      send: (name, extra, pass) => action(name, extra, pass),
      askPass: WIX,
      state: state.actionState,
      onState: (s) => { state.actionState = s; },
    });
  }
  const answer = state.answers[`${state.page}:${state.range}`];
  if (!answer) return el('div', { class: 'section' }, el('p', { class: 'note', text: state.busy ? 'Reading…' : 'Nothing read yet.' }));
  const blurb = (PAGES.find((p) => p[0] === state.page) || [])[2] || '';
  const wrap = el('div', {});
  wrap.appendChild(el('p', { class: 'note', text: `${blurb} · read ${new Date(answer.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · day buckets are UTC` }));
  wrap.appendChild(renderSection(state.page, answer, {
    downloads: state.downloads,
    days: RANGE_DAYS[state.range] || 30,
    onRevoke: WIX ? null : unlink,
    onReward: reward,
    go: (page) => { touch(); state.page = page; savePrefs({ page, range: state.range }); draw(); if (!state.answers[`${page}:${state.range}`]) load(page, state.range).then(draw); },
  }));
  if (state.page === 'devices' && !WIX) wrap.appendChild(devicesTools());
  return wrap;
}

function draw() {
  dom.header.replaceWith(dom.header = header());
  dom.main.textContent = '';
  dom.main.appendChild(dom.says);
  dom.main.appendChild(body());
}

// ---- the clock that locks it -----------------------------------------------------------------------------------

function watchIdle() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    if (locked()) return;
    if (Date.now() - idleAt > IDLE_MS) { lock('The Console locked itself after fifteen minutes. Type your passphrase to open it again.'); return; }
    if (hiddenSince && Date.now() - hiddenSince > HIDDEN_MS) lock('The Console locked itself while it was in the background. Type your passphrase to open it again.');
  }, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenSince = Date.now(); return; }
    // back in front: if it was away long enough, lock before anything is drawn
    if (hiddenSince && Date.now() - hiddenSince > HIDDEN_MS && !locked()) lock('The Console locked itself while it was in the background. Type your passphrase to open it again.');
    hiddenSince = 0;
    touch();
  });
  for (const ev of ['pointerdown', 'keydown', 'focus']) window.addEventListener(ev, touch, { passive: true });
}

// ---- start ---------------------------------------------------------------------------------------------------

/**
 * Wix mode: no device, no enrollment, no passphrase box, no service worker. Say `ready` until the page
 * answers `hello`, then read the first page. The page checks the owner on the server for every call.
 */
function startWix() {
  bridge = makeBridge({
    post: (msg, target) => window.parent.postMessage(msg, target),
    listen: (fn) => window.addEventListener('message', fn),
    onHello: ({ owner, name }) => {
      const first = !state.wix.known;
      state.wix = { known: true, owner, name };
      draw();
      if (owner && first) load(state.page === 'reports' || state.page === 'actions' ? 'overview' : state.page, state.range).then(draw);
    },
  });
  draw();
  bridge.ready();
  let tries = 0;
  const again = setInterval(() => {
    tries += 1;
    if (state.wix.known || tries > 40) { clearInterval(again); if (!state.wix.known) say('The account site did not answer. Reload the page.', 'alarm'); return; }
    bridge.ready();
  }, 750);
}

export async function start() {
  dom.header = document.querySelector('header.bar') || el('header', { class: 'bar' });
  dom.main = document.getElementById('console');
  dom.says = el('div', { class: 'says', dataset: { consoleSays: 'yes' } });
  if (!dom.header.parentNode) dom.main.parentNode.insertBefore(dom.header, dom.main);

  const prefs = await readPrefs();
  if (prefs.page && pagesHere().some((p) => p[0] === prefs.page)) state.page = prefs.page;
  if (prefs.range && RANGES.some((r) => r[0] === prefs.range)) state.range = prefs.range;

  if (WIX) { startWix(); return; }

  try { state.device = (await readDevice()) || null; } catch { state.device = null; }

  // The code is taken out of the address bar before anything else: a shared screenshot of this page
  // must not carry a live one, even though it is spent the moment it is used.
  const code = enrollCodeFromUrl();
  if (code) await linkWith(code);

  draw();
  // The desktop program reads its kept passphrase before anything asks for one.
  if (state.device && inApp()) await openWithStored();
  watchIdle();
  window.addEventListener('hashchange', () => {
    const fresh = enrollCodeFromUrl();
    if (fresh) linkWith(fresh);
  });

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:' && !inApp()) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a nicety, not a requirement */ });
  }
  if (office.overridden) say(`Talking to ${office.base} (this page is on a loopback address, so the office setting was honored).`);
}

if (typeof document !== 'undefined' && document.getElementById('console')) start();
