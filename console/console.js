// The StellAurator Console — the whole app.
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
//   1. **A key, not a password.** This device signed itself up once, from a code the desktop app
//      showed. Its private key is non-extractable and lives in IndexedDB; every request is signed.
//      Losing the phone costs an Unlink, not a password change.
//   2. **A passphrase this page never stores.** The Gold desk passphrase is typed once per sitting
//      and lives in one variable below. Fifteen idle minutes clears it. Five minutes with the app
//      hidden clears it - a phone put in a pocket is a phone somebody else may pick up. It is never
//      in localStorage, never in IndexedDB, never in a URL and never in a log line.
//   3. **Numbers it can explain.** Every panel names its source; every figure that does not exist
//      says "not collected" rather than showing a zero.
import { officeBase, call, OfficeError } from './office.js';
import { generateKeyPair, publicJwk, deviceIdFor, signRequest } from './sign.js';
import { readDevice, saveDevice, forgetDevice, readReadings, saveReadings, readPrefs, savePrefs } from './store.js';
import { fetchReleases, releaseTotals, latestRelease, addSnapshot, snapshotSeries, totalsOf, RELEASES_PAGE } from './releases.js';
import { buildReport, toText, toCsv, csvFilename, show as showValue, NOT_COLLECTED } from './reports.js';
import { el, panel, grid, table } from './charts.js';
import { renderSection } from './sections.js';
import { renderActions } from './actions.js';

const MIN_PASS = 12;
const IDLE_MS = 15 * 60 * 1000;
const HIDDEN_MS = 5 * 60 * 1000;

const PAGES = [
  ['overview', 'Overview', 'Accounts, the trial, plans, and the computers in the field.'],
  ['downloads', 'Downloads', 'Installer downloads per release, and who is on the newest version.'],
  ['licenses', 'Licenses', 'Gold licenses, invitation-key batches, computers per account.'],
  ['collaboration', 'Sharing', 'Invitations made, opened and accepted. No content, ever.'],
  ['support', 'Support', 'Bug reports and messages, with what people wrote.'],
  ['alpha', 'Alpha', 'The public alpha: testers, sessions, hours, what they used, words recorded. Counts only.'],
  ['audit', 'Audit', 'The ledger: every action, every refusal, every device.'],
  ['reports', 'Reports', 'This week and this month, to copy, download or print.'],
  ['actions', 'Control', 'One account at a time. Every change confirmed and recorded.'],
  ['devices', 'Devices', 'The phones and computers this Console is linked to.'],
];
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

const query = (payload) => signed('consoleQuery', payload);
const action = (name, extra) => signed('consoleAction', { action: name, ...extra });

// ---- the GitHub half -------------------------------------------------------------------------------
//
// Asked by this device, not by the back office. GitHub gives running totals only, so today's reading
// is written down (here and, once a day, on the back office) and the per-day line is the difference.

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
    series: snapshotSeries(saved, { days: { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[state.range] || 30 }),
    total: assets.reduce((n, a) => n + a.count, 0),
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
        days: { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[range] || 30,
        // one small row a day on the back office, so the series survives a new phone
        snapshot: { downloadsTotal: dl.total, perRelease: Object.fromEntries((dl.assets || []).map((a) => [`${a.release}/${a.name}`, a.count])) },
      };
    }
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

/** `#enroll=LINK-XXXX-XXXX` — the code the desktop app showed, in the fragment, so no server saw it. */
function enrollCodeFromUrl() {
  const m = /(?:^|[#&])enroll=([^&]+)/.exec(window.location.hash || '');
  if (!m) return '';
  try { return decodeURIComponent(m[1]).trim().toUpperCase(); } catch { return m[1].trim().toUpperCase(); }
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
  const pair = await generateKeyPair();
  const jwk = await publicJwk(pair.publicKey);
  const deviceId = await deviceIdFor(jwk);
  const label = deviceLabel();
  const r = await call(office.base, 'consoleEnrollFinish', { code, publicKeyJwk: jwk, deviceLabel: label });
  const device = { deviceId: r.deviceId || deviceId, label: r.label || label, linkedAt: new Date().toISOString(), publicJwk: jwk, privateKey: pair.privateKey };
  await saveDevice(device);
  state.device = device;
  return device;
}

// ---- the screens ---------------------------------------------------------------------------------------

function unlinkedScreen(problem) {
  return el(
    'div',
    { class: 'section', dataset: { consoleScreen: 'unlinked' } },
    panel(
      { title: 'This device is not linked yet', wide: true },
      problem ? el('p', { class: 'said-line is-alarm', text: problem }) : null,
      el('p', { text: 'The Console shows the business behind StellAurator: accounts, downloads, licenses, what people wrote in, and the controls that go with them. It is linked from the app itself, once, and then this device signs everything it asks for with a key only it holds.' }),
      el('ol', { class: 'steps' },
        el('li', {}, 'On the computer StellAurator is installed on, open ', el('strong', { text: 'Settings → Account' }), '.'),
        el('li', {}, 'Press ', el('strong', { text: 'Link a Console device' }), ' and type your Gold desk passphrase.'),
        el('li', {}, 'Scan the square it shows with this device\'s camera, or open the link it gives you here.'),
      ),
      el('p', { class: 'note', text: 'The code lasts ten minutes and works once. Nothing about it travels to a server: it is in the part of the address after the # sign, which browsers do not send.' }),
    ),
  );
}

function gateScreen() {
  const box = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', inputmode: 'text', placeholder: 'Your Gold desk passphrase', dataset: { consolePass: 'yes' }, maxlength: '200' });
  const go = el('button', { class: 'btn btn-gold', type: 'submit', dataset: { consoleUnlock: 'yes' }, text: 'Open the Console' });
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
        box.value = '';
        touch();
        draw();
      },
    },
    el('p', { class: 'lede', text: 'Your Gold desk passphrase' }),
    el('div', { class: 'row' }, box, go),
    el('p', { class: 'note', text: 'The same passphrase as the Gold desk, checked on the back office and never on this device. It is asked once per sitting, forgotten after fifteen idle minutes, and forgotten again if this app is left in the background for five.' }),
  );
  return el('div', { class: 'section', dataset: { consoleScreen: 'gate' } }, panel({ title: 'Locked', wide: true }, form));
}

// ---- Reports ----------------------------------------------------------------------------------------------

function reportsScreen() {
  const holder = el('div', { dataset: { reportHolder: 'yes' } });
  const make = async (kind) => {
    say('Reading what the report needs…');
    // a report is the sections summed, so it fetches whatever it has not got rather than new numbers
    for (const page of ['overview', 'collaboration', 'support']) await load(page, state.range);
    if (!state.downloads) { try { await readGithub(); } catch { /* GitHub is allowed to be down */ } }
    const report = buildReport(kind, {
      overview: state.answers[`overview:${state.range}`],
      collaboration: state.answers[`collaboration:${state.range}`],
      support: state.answers[`support:${state.range}`],
      downloads: state.downloads,
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
    const r = await action('alpha:reward', { memberId: tester.memberId, confirm: true });
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
      say('This device is unlinked. It can do nothing here until it is linked again from StellAurator.', 'ok');
      return;
    }
    state.answers['devices:' + state.range] = { ok: true, section: 'devices', data: r, sources: ['The ConsoleDevices collection'], notCollected: [] };
    draw();
    say(`${device.label || 'That device'} is unlinked.`, 'ok');
  } catch (e) {
    say(e.message, 'alarm');
  }
}

// ---- drawing -----------------------------------------------------------------------------------------------

function header() {
  const bar = el('header', { class: 'bar' });
  bar.appendChild(el(
    'div',
    { class: 'bar-top' },
    el('h1', {}, el('span', { class: 'mark', text: 'StellAurator' }), el('span', { class: 'mark-2', text: 'Console' })),
    state.device && !locked()
      ? el('button', { class: 'btn btn-quiet', type: 'button', dataset: { consoleLock: 'yes' }, text: 'Lock', onclick: () => lock('Locked. Type your passphrase to open it again.') })
      : null,
  ));
  if (state.device && !locked()) {
    bar.appendChild(el('nav', { class: 'tabs' }, PAGES.map(([id, label, blurb]) => el('button', {
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
          onclick: () => { touch(); delete state.answers[`${state.page}:${state.range}`]; if (state.page === 'downloads') state.downloads = null; draw(); load(state.page, state.range).then(draw); },
        }),
      ));
    }
  }
  return bar;
}

function body() {
  if (!state.device) return unlinkedScreen(state.problem);
  if (locked()) return gateScreen();
  if (state.page === 'reports') return reportsScreen();
  if (state.page === 'actions') {
    return renderActions({
      send: (name, extra) => action(name, extra),
      state: state.actionState,
      onState: (s) => { state.actionState = s; },
    });
  }
  const answer = state.answers[`${state.page}:${state.range}`];
  if (!answer) return el('div', { class: 'section' }, el('p', { class: 'note', text: state.busy ? 'Reading…' : 'Nothing read yet.' }));
  const blurb = (PAGES.find((p) => p[0] === state.page) || [])[2] || '';
  const wrap = el('div', {});
  wrap.appendChild(el('p', { class: 'note', text: `${blurb} · read ${new Date(answer.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · day buckets are UTC` }));
  wrap.appendChild(renderSection(state.page, answer, { downloads: state.downloads, onRevoke: unlink, onReward: reward }));
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

export async function start() {
  dom.header = document.querySelector('header.bar') || el('header', { class: 'bar' });
  dom.main = document.getElementById('console');
  dom.says = el('div', { class: 'says', dataset: { consoleSays: 'yes' } });
  if (!dom.header.parentNode) dom.main.parentNode.insertBefore(dom.header, dom.main);

  const prefs = await readPrefs();
  if (prefs.page && PAGES.some((p) => p[0] === prefs.page)) state.page = prefs.page;
  if (prefs.range && RANGES.some((r) => r[0] === prefs.range)) state.range = prefs.range;

  try { state.device = (await readDevice()) || null; } catch { state.device = null; }

  // The code is taken out of the address bar before anything else: a shared screenshot of this page
  // must not carry a live one, even though it is spent the moment it is used.
  const code = enrollCodeFromUrl();
  if (code) await linkWith(code);

  draw();
  watchIdle();
  window.addEventListener('hashchange', () => {
    const fresh = enrollCodeFromUrl();
    if (fresh) linkWith(fresh);
  });

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a nicety, not a requirement */ });
  }
  if (office.overridden) say(`Talking to ${office.base} (this page is on a loopback address, so the office setting was honored).`);
}

if (typeof document !== 'undefined' && document.getElementById('console')) start();
