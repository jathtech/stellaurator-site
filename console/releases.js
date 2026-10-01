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
// The arithmetic below is pure and is what tests/ownerStats.test.mjs runs. `fetchReleases` is the
// only part that touches the network.

export const RELEASE_OWNER = 'jathtech';
export const RELEASE_REPO = 'stellaurator-releases';
export const RELEASES_PAGE = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases`;
export const RELEASES_API = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases?per_page=30`;

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
