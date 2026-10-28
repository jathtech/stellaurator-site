// Installer downloads, read from GitHub by the Console itself.
//
// GitHub's releases API for a public repository is public: no key, no account, no server in the
// middle. So the Console asks it directly from the browser and the back office is never told a
// download figure at all - which keeps that side to what it really holds, and means a rate limit
// or an outage at GitHub is one panel saying so rather than a page that will not load.
//
// GitHub gives **running totals only**. There is no per-day figure in the API and no way to ask for
// one, so a per-day line has to be built by writing the total down once a day and subtracting. The
// Console keeps that series in IndexedDB on this device AND (one small row a day) on the back
// office, so replacing a phone does not start the series again. Everything that follows from
// subtracting running totals is stated on screen:
//
//   * a per-day line needs two readings on two different days; a device that opened the Console for
//     the first time today has none;
//   * the first reading carries no delta - 500 lifetime downloads did not all happen on Monday;
//   * a total that went DOWN (an asset replaced, a release deleted) is a zero, never a negative day;
//   * an asset that did not exist at the last reading is not a day's worth of downloads;
//   * a day nobody opened the Console is a GAP, not a day of zero downloads.
//
// Two more things are stated, and they are site/wix/README.md §14 (owner 2026-10-02: "I want my own
// downloads and tests to be excluded from these numbers altogether"):
//
//   * an installer, a blockmap and latest.yml are three different things and are never summed: the
//     app reads latest.yml on every launch, so a sum is mostly one computer checking for updates;
//   * the figure that means other people is GitHub's count since the test baseline, less what the
//     owner's computers and Claude's tool reported fetching. GitHub's own counters, which include
//     both, are shown only as GitHub's.
//
// The arithmetic below is pure and is what tests/ownerStats.test.mjs and tests/consoleTest.test.mjs
// run. `fetchReleases` is the only part that touches the network.

export const RELEASE_OWNER = 'jathtech';
export const RELEASE_REPO = 'stellaurator-releases';
export const RELEASES_PAGE = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases`;
// 100 is the most GitHub answers on one page. At 30 the oldest releases fell off the end (there were 48
// on 2026-10-02), and with them every download anybody ever made of them.
export const RELEASES_API = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases?per_page=100`;

const DAY_MS = 86400000;
const KEEP_DAYS = 400;

/** '0.14.0' vs '0.9.2' the way a person means it: -1, 0 or 1. Anything unparsable sorts last. */
export function compareVersions(a, b) {
  const parse = (v) => String(v || '').trim().replace(/^v/i, '').split(/[.-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : -1));
  const x = parse(a);
  const y = parse(b);
  const bad = (p) => !p.length || p[0] < 0;
  if (bad(x) && bad(y)) return 0;
  if (bad(x)) return -1;
  if (bad(y)) return 1;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const l = x[i] == null ? 0 : x[i];
    const r = y[i] == null ? 0 : y[i];
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

const dayKey = (v) => {
  const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(String(v || ''));
  return Number.isFinite(t) && t ? new Date(t).toISOString().slice(0, 10) : '';
};

const dayKeys = (days, now) => {
  const end = now || Date.now();
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(dayKey(end - i * DAY_MS));
  return out;
};

/** Every asset of every release, flattened, from what the GitHub releases API answers. */
export function releaseTotals(releases) {
  const out = [];
  for (const r of releases || []) {
    for (const a of r.assets || []) {
      out.push({
        release: String(r.tag_name || r.name || ''),
        name: String(a.name || ''),
        count: Number(a.download_count) || 0,
        size: Number(a.size) || 0,
        publishedAt: r.published_at || r.created_at || null,
        url: String(r.html_url || ''),
        prerelease: !!r.prerelease,
      });
    }
  }
  return out.sort((a, b) => compareVersions(b.release, a.release) || b.count - a.count);
}

/** The newest real release, for "who is on the newest version". Drafts and pre-releases stand aside. */
export function latestRelease(releases) {
  const live = (releases || []).filter((r) => !r.draft && !r.prerelease);
  const pick = (live.length ? live : releases || []).slice().sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];
  if (!pick) return { tag: '', version: '', publishedAt: null, url: RELEASES_PAGE };
  return {
    tag: String(pick.tag_name || ''),
    version: String(pick.tag_name || '').replace(/^v/i, ''),
    publishedAt: pick.published_at || pick.created_at || null,
    url: String(pick.html_url || RELEASES_PAGE),
  };
}

/**
 * Add today's reading, replacing an earlier one from the same UTC day - the Console may be opened
 * five times in an afternoon, and the day's LAST reading is the day's total. Old days fall off past
 * `keepDays`. Pure: the list handed in is never changed.
 */
export function addSnapshot(list, sample, { keepDays = KEEP_DAYS } = {}) {
  const at = sample && sample.at ? Date.parse(String(sample.at)) || Date.now() : Date.now();
  const day = dayKey(at);
  if (!day) return [...(list || [])];
  const totals = {};
  for (const [k, v] of Object.entries((sample && sample.totals) || {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) totals[String(k)] = Math.floor(n);
  }
  const kept = (list || []).filter((s) => dayKey(s && s.at) && dayKey(s.at) !== day);
  kept.push({ at: new Date(at).toISOString(), day, totals });
  kept.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return kept.slice(-Math.max(1, keepDays));
}

/**
 * Snapshots -> downloads per day. The first snapshot has no day before it, so it carries no delta:
 * "everything that ever happened happened on Monday" is the one answer this must never give. A
 * total that went DOWN is a zero, never a negative day.
 *
 * -> { perDay, perAsset, total, firstDay, complete, snapshots }
 */
export function snapshotSeries(list, { days = 30, now = Date.now() } = {}) {
  const snaps = [...(list || [])]
    .filter((s) => s && dayKey(s.at))
    .map((s) => ({ day: dayKey(s.at), totals: s.totals || {} }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const keys = dayKeys(days, now);
  const have = new Set(snaps.map((s) => s.day));
  const counts = new Map(keys.map((k) => [k, 0]));
  const added = new Map();
  for (let i = 1; i < snaps.length; i += 1) {
    const before = snaps[i - 1].totals;
    const after = snaps[i].totals;
    let onTheDay = 0;
    for (const [asset, total] of Object.entries(after)) {
      const was = Number(before[asset]);
      // an asset that did not exist at the last reading is not a day's worth of downloads
      const delta = Number(total) - (Number.isFinite(was) ? was : Number(total));
      const up = delta > 0 ? delta : 0;
      onTheDay += up;
      if (up) added.set(asset, (added.get(asset) || 0) + up);
    }
    if (counts.has(snaps[i].day)) counts.set(snaps[i].day, counts.get(snaps[i].day) + onTheDay);
  }
  const latest = snaps.length ? snaps[snaps.length - 1].totals : {};
  const perAsset = Object.entries(latest)
    .map(([key, total]) => ({ key, total: Number(total) || 0, added: added.get(key) || 0 }))
    .sort((a, b) => b.total - a.total || (a.key < b.key ? -1 : 1));
  return {
    perDay: keys.map((day) => ({ day, count: counts.get(day) })),
    perAsset,
    total: perAsset.reduce((n, a) => n + a.total, 0),
    firstDay: snaps.length ? snaps[0].day : '',
    complete: snaps.length > 1 && have.has(keys[0]),
    snapshots: snaps.length,
  };
}

/** One reading, ready for `addSnapshot`: `{ '<release>/<asset>': count }`. */
export function totalsOf(assets) {
  const totals = {};
  for (const a of assets || []) totals[`${a.release}/${a.name}`] = Number(a.count) || 0;
  return totals;
}

export const perReleaseTotals = (assets) => {
  const out = [];
  for (const a of assets || []) {
    const row = out.find((r) => r.key === a.release);
    if (row) row.count += Number(a.count) || 0;
    else out.push({ key: a.release || 'untagged', count: Number(a.count) || 0 });
  }
  return out;
};

/**
 * GitHub, or a sentence about GitHub. `url` is overridable so the proof can stand one up on
 * loopback; the Console itself always passes the real address.
 */
export async function fetchReleases({ url = RELEASES_API, timeoutMs = 15000 } = {}) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error('GitHub answered something unexpected');
    return { releases: body, error: '' };
  } catch (e) {
    return {
      releases: [],
      error: `The download counts could not be read from GitHub (${String((e && e.message) || e).slice(0, 100)}). Everything else on this page is current.`,
    };
  }
}

// ---- three kinds of asset, never summed together again (site/wix/README.md §14) ------------------------
//
// A release carries three files, and GitHub counts a fetch of each one as a "download":
//
//   installers  StellAurator-Setup-<v>.exe   a person (or an update) downloading the program
//   blockmaps   <installer>.exe.blockmap     the updater reading one or two of these to download only
//                                            the blocks that changed - never a person
//   feedReads   latest.yml                   the app reading the update feed, on every launch and
//                                            every six hours - an update check, not a download
//
// Summed together, 128 update checks by one computer read as 128 downloads. So they are three
// figures, everywhere, and the one that answers "how many people downloaded StellAurator" is
// installers alone - and only the part of it that is not the owner's or Claude's (below).

export const ASSET_KINDS = ['installers', 'blockmaps', 'feedReads'];

/** An asset's name -> 'installers' | 'blockmaps' | 'feedReads' | 'other'. */
export function assetKind(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.blockmap')) return 'blockmaps';
  if (n.endsWith('.exe')) return 'installers';
  if (n.endsWith('.yml') || n.endsWith('.yaml')) return 'feedReads';
  return 'other';
}

/** The asset part of a reading's key: '<release>/<asset>' -> '<asset>'. */
const assetOfKey = (key) => String(key || '').slice(String(key || '').lastIndexOf('/') + 1);

/** Assets -> { installers, blockmaps, feedReads, other }: each kind on its own. */
export function kindTotals(assets) {
  const out = { installers: 0, blockmaps: 0, feedReads: 0, other: 0 };
  for (const a of assets || []) out[assetKind(a.name)] += Number(a.count) || 0;
  return out;
}

/**
 * Assets -> one row per release, newest first, the three kinds side by side:
 * [{ release, installers, blockmaps, feedReads, installerSize, publishedAt, prerelease, url }]
 */
export function splitPerRelease(assets) {
  const rows = new Map();
  for (const a of assets || []) {
    const key = a.release || 'untagged';
    const row = rows.get(key) || { release: key, installers: 0, blockmaps: 0, feedReads: 0, other: 0, installerSize: 0, publishedAt: a.publishedAt || null, prerelease: !!a.prerelease, url: a.url || '' };
    const kind = assetKind(a.name);
    row[kind] += Number(a.count) || 0;
    if (kind === 'installers') row.installerSize = Math.max(row.installerSize, Number(a.size) || 0);
    rows.set(key, row);
  }
  return [...rows.values()].sort((x, y) => compareVersions(y.release, x.release));
}

/** A reported kind (TestActivity) -> the asset kind it is a fetch of. */
export const REPORTED_KIND = { feedCheck: 'feedReads', installerDownload: 'installers', blockmapFetch: 'blockmaps' };

const instant = (v) => {
  const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : 0;
};

/**
 * The reading the subtraction starts from: the first daily reading taken AT OR AFTER the baseline
 * whose per-asset totals are there. A reading from earlier the same day is not one: what was fetched
 * between it and the baseline was the owner's, and it would be counted as other people. This device's
 * own readings come first (a day's reading is its LAST of that day, and its `at` is the moment it
 * was taken); the back office's saved row (`saved`, from the downloads section; its `at` is when the
 * day's row was first written, so the totals in it were read then or later) stands in for a device
 * that has none that old. With neither, the reading being taken NOW is the baseline, and nothing is
 * "other people" until a later reading shows growth.
 *
 * -> { source: 'device' | 'office' | 'now', day, at, totals }
 */
export function baselineReading({ baselineAt, readings = [], saved = null, current = {}, now = Date.now() } = {}) {
  const from = instant(baselineAt);
  const usable = (r) => r && dayKey(r.at || r.day) && r.totals && typeof r.totals === 'object' && Object.keys(r.totals).length;
  const candidates = [
    ...(readings || []).filter(usable).map((r) => ({ source: 'device', day: r.day || dayKey(r.at), at: new Date(instant(r.at)).toISOString(), totals: r.totals })),
    ...(saved && usable({ ...saved, at: saved.at || saved.day }) ? [{ source: 'office', day: String(saved.day || dayKey(saved.at)), at: saved.at ? new Date(instant(saved.at)).toISOString() : `${saved.day}T00:00:00.000Z`, totals: saved.totals }] : []),
  ].filter((c) => from && instant(c.at) >= from);
  // the earliest; at the same moment, this device's own reading
  candidates.sort((a, b) => (instant(a.at) - instant(b.at)) || ((a.source === 'device' ? 0 : 1) - (b.source === 'device' ? 0 : 1)));
  if (candidates.length) return candidates[0];
  return { source: 'now', day: dayKey(now), at: new Date(instant(now)).toISOString(), totals: { ...(current || {}) } };
}

/**
 * The Downloads page's subtraction, per kind of asset:
 *
 *     others = max(0, githubTotal - baselineTotal - reportedOwner - reportedClaude)
 *
 * `githubTotal` is GitHub's count now. `baselineTotal` is GitHub's count in the baseline reading
 * (`baselineReading` above) - test activity by definition, since nobody else had downloaded anything
 * before TEST_BASELINE. `reportedOwner` and `reportedClaude` are the fetches the owner's computers and
 * Claude's tool reported AFTER that reading was taken (a fetch before it is already in it).
 *
 * Per asset, a count can only grow: an asset that is not in the baseline reading counts from zero
 * when its release was published after the reading, and from its own count otherwise (it existed
 * and the reading did not list it, which is not a day of downloads); a count that went DOWN (an
 * asset replaced) is no growth, never negative.
 *
 * `counted` is the back office's `{ owner: { feedCheck:[ms…], … }, claude: { … } }`.
 * With no `baselineAt` there is nothing to subtract from: `ready` is false and every `others` is null.
 *
 * -> { ready, baseline: { at, readingAt, readingDay, source }, kinds: { installers: { github,
 *      baseline, growth, owner, claude, others }, blockmaps: {…}, feedReads: {…} } }
 */
export function othersByKind({ assets = [], baselineAt = null, readings = [], saved = null, counted = null, now = Date.now() } = {}) {
  const current = totalsOf(assets);
  const kinds = Object.fromEntries(ASSET_KINDS.map((k) => [k, { github: 0, baseline: 0, growth: 0, owner: 0, claude: 0, others: null }]));
  for (const a of assets || []) {
    const k = assetKind(a.name);
    if (kinds[k]) kinds[k].github += Number(a.count) || 0;
  }
  if (!baselineAt || !instant(baselineAt)) {
    return { ready: false, baseline: null, kinds, perRelease: {} };
  }
  const reading = baselineReading({ baselineAt, readings, saved, current, now });
  const readingAt = instant(reading.at);
  const perRelease = {};
  for (const a of assets || []) {
    const k = assetKind(a.name);
    if (!kinds[k]) continue;
    const key = `${a.release}/${a.name}`;
    const count = Number(a.count) || 0;
    const had = Object.prototype.hasOwnProperty.call(reading.totals, key) ? Number(reading.totals[key]) || 0
      : (instant(a.publishedAt) > readingAt ? 0 : count);
    kinds[k].baseline += had;
    kinds[k].growth += Math.max(0, count - had);
    const row = perRelease[a.release] || (perRelease[a.release] = { installers: 0, blockmaps: 0, feedReads: 0 });
    row[k] += had;
  }
  const after = (list) => (list || []).filter((t) => instant(t) > readingAt).length;
  for (const [reported, k] of Object.entries(REPORTED_KIND)) {
    kinds[k].owner += after(counted && counted.owner && counted.owner[reported]);
    kinds[k].claude += after(counted && counted.claude && counted.claude[reported]);
  }
  for (const k of ASSET_KINDS) kinds[k].others = Math.max(0, kinds[k].growth - kinds[k].owner - kinds[k].claude);
  return {
    ready: true,
    baseline: { at: new Date(instant(baselineAt)).toISOString(), readingAt: reading.at, readingDay: reading.day, source: reading.source },
    kinds,
    // per release, what GitHub had counted in the baseline reading: `before the baseline` on the Test page
    perRelease,
  };
}

/**
 * Other people, per day, for one kind: the growth between two consecutive readings of this device,
 * less what the owner and Claude reported between those two moments, never below zero - from the
 * baseline reading on. A day before it, or with no reading, is a zero inside the window, as on the
 * all-downloads line. -> [{ day, count }] oldest first, `days` long
 */
export function othersPerDay({ kind = 'installers', readings = [], baselineAt = null, counted = null, days = 30, now = Date.now() } = {}) {
  const keys = dayKeys(days, now);
  const counts = new Map(keys.map((k) => [k, 0]));
  const from = instant(baselineAt);
  if (!from) return keys.map((day) => ({ day, count: 0 }));
  const snaps = [...(readings || [])]
    .filter((s) => s && dayKey(s.at) && instant(s.at) >= from && s.totals)
    .sort((a, b) => instant(a.at) - instant(b.at));
  const reportedKinds = Object.entries(REPORTED_KIND).filter(([, k]) => k === kind).map(([r]) => r);
  const times = [];
  for (const who of ['owner', 'claude']) for (const r of reportedKinds) times.push(...(((counted || {})[who] || {})[r] || []).map(instant));
  for (let i = 1; i < snaps.length; i += 1) {
    const before = snaps[i - 1];
    const after = snaps[i];
    let grew = 0;
    for (const [key, total] of Object.entries(after.totals)) {
      if (assetKind(assetOfKey(key)) !== kind) continue;
      const was = Number(before.totals[key]);
      // an asset that did not exist at the last reading is not a day's worth of downloads
      grew += Math.max(0, Number(total) - (Number.isFinite(was) ? was : Number(total)));
    }
    const t0 = instant(before.at);
    const t1 = instant(after.at);
    const ours = times.filter((t) => t > t0 && t <= t1).length;
    const day = after.day || dayKey(after.at);
    if (counts.has(day)) counts.set(day, counts.get(day) + Math.max(0, grew - ours));
  }
  return keys.map((day) => ({ day, count: counts.get(day) }));
}

/**
 * Everything the Downloads page, the Test page and a report need, from the two halves the Console
 * has: `github` (this device's reading of GitHub: { assets, readings, latest }) and `test` (the back
 * office's: { baseline, reading, counted, countedCapped } - the downloads section's `data.test`, or
 * the test section's `data`).
 *
 * -> othersByKind's answer, plus { perDay: { installers, feedReads }, readingsSince, latest, countedCapped }
 */
export function downloadSplit({ github = null, test = null, days = 30, now = Date.now() } = {}) {
  const g = github || {};
  const t = test || {};
  const baselineAt = (t.baseline && t.baseline.at) || null;
  const readings = g.readings || [];
  const split = othersByKind({ assets: g.assets || [], baselineAt, readings, saved: t.reading || null, counted: t.counted || null, now });
  const from = instant(baselineAt);
  return {
    ...split,
    perDay: {
      installers: othersPerDay({ kind: 'installers', readings, baselineAt, counted: t.counted, days, now }),
      feedReads: othersPerDay({ kind: 'feedReads', readings, baselineAt, counted: t.counted, days, now }),
    },
    readingsSince: from ? readings.filter((r) => instant(r && r.at) >= from).length : 0,
    latest: g.latest || {},
    countedCapped: !!t.countedCapped,
  };
}
