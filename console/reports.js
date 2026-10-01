// "This week" and "This month", built in the browser from what is already on screen.
//
// Owner, 2026-09-20: "give me reports and stuff". A report is not a seventh section with its own
// queries - it is the same numbers, summed over a window, in an order somebody can read out loud
// or paste into an email. So nothing here talks to anything: it takes the section envelopes the
// Console already fetched and returns rows. That means a report can be made on a train with no
// signal, and it means the report can never disagree with the page it came from.
//
// Two honesty rules, both visible in the output:
//
//   * a window is TRAILING and UTC - "the 7 days ending 2026-09-20 (UTC)" - because the rows carry
//     instants, the owner travels, and a week that moves with the reader cannot be compared with
//     last week's. It is not a calendar week, and it says so.
//   * a number that does not exist is written "not collected", never 0. A zero is a fact about the
//     business; a blank is a fact about the software, and the two must not look alike.
//
// Pure, so tests/consoleReports.test.mjs runs this file and parses its own CSV back.

export const KINDS = ['week', 'month'];
export const DAY_MS = 86400000;
export const NOT_COLLECTED = 'not collected';

const dayKey = (t) => new Date(Number(t)).toISOString().slice(0, 10);

/** The last 7 or 30 UTC days, ending on the day `now` falls in. */
export function reportWindow(kind, now = Date.now()) {
  const days = kind === 'month' ? 30 : 7;
  const to = Number(now) || Date.now();
  return {
    kind: kind === 'month' ? 'month' : 'week',
    days,
    label: kind === 'month' ? 'This month' : 'This week',
    toDay: dayKey(to),
    fromDay: dayKey(to - (days - 1) * DAY_MS),
    generatedAt: new Date(to).toISOString(),
  };
}

/** How many of a day series fall inside the window. A missing day contributes nothing. */
export function sumDays(points, win) {
  let n = 0;
  let had = false;
  for (const p of points || []) {
    const day = String((p && p.day) || '');
    if (day >= win.fromDay && day <= win.toDay) { n += Number(p.count) || 0; had = true; }
  }
  return had ? n : null;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
/** A number is grouped; a name (a release tag) is left alone; nothing at all says so. */
export const show = (v) => (v == null ? NOT_COLLECTED : typeof v === 'number' ? v.toLocaleString('en-US') : String(v));

/**
 * The report.
 *
 * `sections` is whatever the Console has: `{ overview, collaboration, support }` envelopes as the
 * back office answered them, plus `downloads` as releases.js worked it out. Anything missing
 * becomes "not collected" rather than a hole - a report made before the Downloads page was ever
 * opened should say so, not imply nobody downloaded anything.
 *
 * -> { window, title, subtitle, groups:[{ group, rows:[{ label, value, note }] }], rows, flat }
 */
export function buildReport(kind, sections = {}, now = Date.now()) {
  const win = reportWindow(kind, now);
  const overview = (sections.overview && sections.overview.data) || {};
  const collab = (sections.collaboration && sections.collaboration.data) || {};
  const support = (sections.support && sections.support.data && sections.support.data.support) || {};
  const downloads = sections.downloads || null;

  const accounts = overview.accounts || {};
  const trials = overview.trials || {};
  const plans = overview.plans || {};
  const seats = overview.seats || {};
  const invites = collab.invites || {};

  const groups = [];
  const add = (group, rows) => groups.push({ group, rows: rows.filter(Boolean) });

  add('Accounts', [
    { label: 'New accounts', value: sumDays(accounts.perDay, win), note: `per-day rows, ${win.fromDay} to ${win.toDay} UTC` },
    { label: 'Accounts in total', value: num(accounts.total), note: 'every account on the website, all time' },
  ]);

  add('The free trial', [
    { label: 'Trials started', value: sumDays(trials.startedPerDay, win), note: 'in this window' },
    { label: 'Trials running now', value: num(trials.running), note: 'at this moment, not in the window' },
    { label: 'Trial accounts that later held a plan', value: num(trials.converted), note: `${num(trials.conversionPercent) == null ? NOT_COLLECTED : `${trials.conversionPercent}%`} of all trials ever - a fact about the account, not a claim about why` },
  ]);

  add('Plans', [
    { label: 'Live plans and Gold licenses', value: num(plans.live), note: 'at this moment' },
    ...(plans.kinds || []).map((k) => ({ label: `- ${k.key}`, value: num(k.count), note: `${k.percent}% of live` })),
  ]);

  add('Computers in the field', [
    { label: 'Active today', value: num(seats.active1), note: 'signed in or refreshed a lease' },
    { label: 'Active this week', value: num(seats.active7), note: '' },
    { label: 'Active in 30 days', value: num(seats.active30), note: '' },
    { label: 'New computers', value: sumDays(seats.newPerDay, win), note: 'in this window' },
  ]);

  add('Downloads', downloads
    ? [
      { label: 'Installer downloads in this window', value: downloads.series && downloads.series.snapshots > 1 ? sumDays(downloads.series.perDay, win) : null, note: downloads.series && downloads.series.snapshots > 1 ? `from ${downloads.series.snapshots} daily readings` : 'a per-day figure needs two daily readings; GitHub gives running totals only' },
      { label: 'Downloads, all releases, all time', value: num(downloads.total), note: 'GitHub\'s running total' },
      { label: 'Newest release', value: (downloads.latest && downloads.latest.tag) || null, note: 'the newest release on GitHub that is not a pre-release' },
    ]
    : [{ label: 'Installer downloads', value: null, note: 'the Downloads page has not been opened in this sitting' }]);

  add('Collaboration', [
    { label: 'Invitations made', value: sumDays(invites.perDay, win), note: 'in this window' },
    { label: 'Invitations accepted', value: sumDays(invites.acceptedPerDay, win), note: 'in this window' },
    { label: 'Invitations made, all time', value: num(invites.created), note: '' },
  ]);

  add('Support', [
    { label: 'Bug reports', value: sumDays(support.bugsPerDay, win), note: 'in this window' },
    { label: 'Contact messages', value: sumDays(support.contactsPerDay, win), note: 'in this window' },
  ]);

  const rows = [];
  for (const g of groups) for (const r of g.rows) rows.push({ group: g.group, ...r });

  return {
    window: win,
    title: `StellAurator - ${win.label}`,
    subtitle: `The ${win.days} days ending ${win.toDay} (UTC). Every number is an aggregate; nothing about any book exists to report.`,
    groups,
    rows,
  };
}

// ---- out of the browser -------------------------------------------------------------------------

/** What "Copy as text" puts on the clipboard. Plain enough to paste into an email. */
export function toText(report) {
  const out = [report.title, report.subtitle, ''];
  for (const g of report.groups) {
    out.push(`${g.group}`);
    for (const r of g.rows) out.push(`  ${r.label}: ${show(r.value)}${r.note ? `  (${r.note})` : ''}`);
    out.push('');
  }
  out.push(`Made by the StellAurator Console, ${report.window.generatedAt}`);
  return out.join('\n');
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV, CRLF line endings, with a header row - which is what a spreadsheet expects. */
export function toCsv(report) {
  const lines = [['Group', 'Measure', 'Value', 'Note'].join(',')];
  for (const r of report.rows) {
    lines.push([cell(r.group), cell(r.label), cell(r.value == null ? NOT_COLLECTED : r.value), cell(r.note)].join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export const csvFilename = (report) => `stellaurator-${report.window.kind}-${report.window.toDay}.csv`;

/**
 * A small CSV reader, here so the tests and the browser proof can parse what the Console wrote
 * rather than trusting that it wrote it. Quotes, doubled quotes, embedded commas and newlines.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const push = () => { row.push(field); field = ''; };
  const endRow = () => { push(); rows.push(row); row = []; };
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { push(); continue; }
    if (c === '\r') { if (s[i + 1] === '\n') i += 1; endRow(); continue; }
    if (c === '\n') { endRow(); continue; }
    field += c;
  }
  if (field || row.length) endRow();
  return rows.filter((r) => r.length > 1 || (r[0] || '').length);
}
