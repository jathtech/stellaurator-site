// The Numbers pages: Overview, Downloads, Licenses, Collaboration, Support, Alpha, Audit, Devices.
//
// Every panel is the same shape - the big plain totals, then a small chart, then one line saying
// where the numbers came from - and every section ends with the list of things somebody would
// reasonably look for here and not find, with the reason. That list is not decoration: the owner
// asked "what percentage of people use this feature", nobody has that number, and a blank space
// where it would go is how a person ends up believing a figure that was never measured.
import {
  el, daySeries, dayText, empty, funnel, grid, notCollected, num, panel, pct, rankedBars, ring,
  stat, stats, table, whenText,
} from './charts.js';
import { perReleaseTotals } from './releases.js';

const GOLD = 'var(--gilt)';
const SILVER = 'var(--sterling)';
const WARM = 'var(--candle)';
const ALARM = '#FF7A8A';

const size = (bytes) => (bytes > 0 ? `${(bytes / 1048576).toFixed(0)} MB` : '');

// ---- Overview ------------------------------------------------------------------------------

function overview(answer) {
  const d = (answer && answer.data) || {};
  const a = d.accounts || {};
  const t = d.trials || {};
  const p = d.plans || {};
  const s = d.seats || {};
  const src = (answer && answer.sources) || [];
  return grid(
    panel(
      { title: 'Accounts', note: 'Every account on the website, however it was made.', source: src[0] },
      stats(stat('Accounts', num(a.total)), stat('New today', num(a.new1)), stat('New this week', num(a.new7)), stat('New in 30 days', num(a.new30))),
      daySeries(a.perDay, { label: 'New accounts per day', color: GOLD }),
    ),
    panel(
      { title: 'The free trial', note: 'Seven days of the whole studio, no card. One per person, one per computer.', source: src[1] },
      stats(stat('Started', num(t.started)), stat('Running now', num(t.running)), stat('Ended', num(t.ended)), stat('Later held a plan', num(t.converted), pct(t.conversionPercent))),
      el('div', { class: 'row' }, ring(t.converted, t.started, 'Trial accounts that later held a plan', WARM)),
      el('p', { class: 'note', text: `${num(t.converted)} of ${num(t.started)} accounts that started a trial hold, or have held, a plan or a Gold license. That is a fact about the account, not a claim about why they bought.` }),
      daySeries(t.startedPerDay, { label: 'Trials started per day', color: WARM }),
    ),
    panel(
      { title: 'Plans', note: 'Granted plans, paid subscriptions, and perpetual Gold - all as a share of one whole.', source: src[2] },
      stats(stat('Live plans', num(p.live)), stat('Orders ever', num(p.total)), stat('Gold, live', num((p.gold || {}).live), '', 'gold'), stat('Gold, revoked', num((p.gold || {}).revoked))),
      rankedBars(p.kinds, { label: 'Plans by kind', color: GOLD }),
    ),
    panel(
      { title: 'Computers', note: 'An install is counted when it signs in or quietly refreshes its lease. Nothing else about it is known.', source: src[4] },
      stats(stat('Active today', num(s.active1)), stat('This week', num(s.active7)), stat('In 30 days', num(s.active30)), stat('Removed by their owners', num(s.removed))),
      el('p', { class: 'note', text: 'By app version, over the computers seen in the last 30 days:' }),
      rankedBars(s.byVersion, { label: 'By version', color: GOLD }),
      el('p', { class: 'note', text: 'By platform:' }),
      rankedBars(s.byPlatform, { label: 'By platform', color: SILVER, max: 6 }),
      daySeries(s.newPerDay, { label: 'New computers per day', color: SILVER }),
    ),
  );
}

// ---- Downloads ------------------------------------------------------------------------------

function downloads(answer, ctx) {
  const dl = (ctx && ctx.downloads) || {};
  const d = (answer && answer.data) || {};
  const adoption = d.adoption || {};
  const series = dl.series || {};
  const latest = dl.latest || {};
  const assets = dl.assets || [];
  const live = (adoption.onLatest || 0) + (adoption.behind || 0) + (adoption.unknown || 0);
  return grid(
    dl.error ? el('p', { class: 'panel is-alarm is-wide', dataset: { githubError: 'yes' }, text: dl.error }) : null,
    panel(
      {
        title: 'Installer downloads',
        note: 'Every asset on every release, as GitHub counts them. A download is not an install, and an install is not a sign-in.',
        source: 'GitHub releases API, asked by this device - the back office never holds a download figure',
      },
      stats(stat('Downloads, all releases', num(dl.total)), stat('Newest release', latest.tag || '-', latest.publishedAt ? whenText(latest.publishedAt) : '', 'gold')),
      rankedBars(perReleaseTotals(assets), { label: 'Downloads per release', color: GOLD, showPercent: false }),
      el('p', {}, el('a', { class: 'link', href: dl.releasesPage || 'https://github.com', target: '_blank', rel: 'noreferrer', dataset: { releases: 'yes' }, text: 'Open the release page on GitHub' })),
    ),
    panel(
      {
        title: 'Downloads per day',
        note: 'GitHub only gives a running total, so the Console writes that total down once a day and subtracts.',
        source: series.snapshots
          ? `${series.snapshots} daily reading${series.snapshots === 1 ? '' : 's'} saved on this device, first on ${series.firstDay}${series.complete ? '' : ' - the window starts before the first reading, so the earliest days are blank'}`
          : 'No readings saved yet - the first one is being written now.',
      },
      series.snapshots > 1
        ? daySeries(series.perDay, { label: 'Downloads per day', color: GOLD })
        : empty('A per-day line needs two readings on two different days. Open this page again tomorrow and it starts drawing.'),
      rankedBars((series.perAsset || []).map((x) => ({ key: x.key, count: x.total })), { label: 'Total per asset', color: SILVER, showPercent: false, max: 8 }),
      (d.saved || []).length > 1
        ? el('p', { class: 'caption', text: `The back office has kept ${(d.saved || []).length} daily rows as well, so this line survives a new phone.` })
        : null,
    ),
    panel(
      { title: 'Update adoption', note: 'Of the computers that checked in over the last 30 days, how many are running the newest release.', source: (answer && answer.sources && answer.sources[0]) || '' },
      el(
        'div',
        { class: 'row' },
        ring(adoption.onLatest, live, `On ${adoption.latest || 'the newest release'}`, WARM),
        el(
          'div',
          { class: 'lines' },
          el('p', {}, el('strong', { text: num(adoption.onLatest) }), ` on the newest release (${pct(adoption.percentOnLatest)})`),
          el('p', {}, el('strong', { text: num(adoption.behind) }), ' on an older one'),
          el('p', {}, el('strong', { text: num(adoption.unknown) }), ' did not say which'),
          el('p', { class: 'note', text: 'Updates are offered, never forced, and never installed over a recording.' }),
        ),
      ),
      rankedBars(adoption.rows, { label: 'Computers by version', color: GOLD }),
    ),
    panel(
      { title: 'Every asset', note: 'Name, release and lifetime count.', source: 'GitHub releases API', wide: true },
      assets.length
        ? table(assets.slice(0, 20).map((x) => ({
          dataset: { asset: x.name },
          cells: [x.name, { text: `${x.release}${x.prerelease ? ' · pre-release' : ''}`, class: 'dim' }, { text: size(x.size), class: 'dim' }, { text: num(x.count), class: 'mono right' }],
        })))
        : empty('No release assets were read.'),
    ),
    panel(
      { title: 'Controlling distribution', note: 'What this page could do next. None of it is built.', source: 'docs/OWNER_CONSOLE.md', wide: true },
      el(
        'ul',
        { class: 'bullets' },
        el('li', {}, el('strong', { text: 'Hold an update back.' }), ' A row on the site saying "do not offer anything newer than X yet", read by the updater, so a bad build stops spreading within minutes instead of within a release.'),
        el('li', {}, el('strong', { text: 'A staged rollout.' }), ' Offer a new version to a share of computers first and watch the crash and bug-report rate before the rest are told.'),
        el('li', {}, el('strong', { text: 'A minimum supported version.' }), ' Below it the app says, in its own words, that it is too old to talk to the back office - rather than failing in ways nobody can read.'),
        el('li', {}, el('strong', { text: 'Re-issue an installer link.' }), ' Mint a fresh download link with a sign-in code for one customer, from here.'),
      ),
    ),
  );
}

// ---- Licenses ---------------------------------------------------------------------------------

function licenses(answer) {
  const d = (answer && answer.data) || {};
  const batches = d.batches || [];
  const keys = d.keys || {};
  const gold = d.gold || {};
  const pressure = d.pressure || {};
  const src = (answer && answer.sources) || [];
  return grid(
    panel(
      { title: 'Invitation keys', note: 'Alpha passes and Gold keys, by the batch they were minted in.', source: src[0] },
      stats(
        stat('Keys made', num(keys.made)),
        stat('Redeemed', num(keys.used), keys.made ? pct(Math.round((keys.used / keys.made) * 1000) / 10) : ''),
        stat('Still out there', num((keys.made || 0) - (keys.used || 0))),
        stat('Gold, live', num(gold.live), '', 'gold'),
      ),
      batches.length
        ? table(batches.map((b) => ({
          dataset: { batch: b.batch },
          cells: [{ text: b.batch, class: 'strong' }, { text: `${num(b.made)} made`, class: 'dim' }, `${num(b.used)} used · ${pct(b.usedPercent)}`, { text: `${num(b.unused)} unused`, class: 'dim' }, { text: b.lastUsedAt ? `last ${dayText(b.lastUsedAt)}` : 'never used', class: 'dim' }],
        })))
        : empty('No invitation keys have been minted.'),
      rankedBars(batches.map((b) => ({ key: b.batch, count: b.used, percent: b.usedPercent })), { label: 'Redeemed per batch', color: GOLD }),
    ),
    panel(
      {
        title: 'Computers per account',
        note: `An account may be signed in on ${pressure.limit || 3} computers. "Ever" counts removed ones too - a person has a few, a key passed around keeps collecting them.`,
        source: src[2],
      },
      stats(
        stat(`At ${pressure.limit || 3} of ${pressure.limit || 3}`, num((pressure.atLimit || []).length)),
        stat(`More than ${pressure.over || 6} ever`, num((pressure.churn || []).length), '', (pressure.churn || []).length ? 'alarm' : ''),
      ),
      (pressure.churn || []).length
        ? el(
          'div',
          {},
          el('p', { class: 'note', text: 'Worth a look - nothing happens automatically:' }),
          table((pressure.churn || []).slice(0, 12).map((r) => ({
            dataset: { churn: r.memberId },
            cells: [r.email || `${r.memberId.slice(0, 10)}…`, { text: `${num(r.ever)} computers ever`, class: 'alarm' }, { text: `${num(r.live)} now · ${num(r.removed)} removed`, class: 'dim' }],
          }))),
        )
        : empty('No account has collected an unusual number of computers.'),
      (pressure.atLimit || []).length
        ? el('p', { class: 'note', text: `${num((pressure.atLimit || []).length)} account${(pressure.atLimit || []).length === 1 ? ' is' : 's are'} at the limit right now. That is normal for a household; they free a place themselves under Settings → Account.` })
        : null,
    ),
    el('p', { class: 'panel is-dashed is-wide note', text: 'Making and revoking Gold licenses moved to the Account control page, where every change is confirmed before it happens.' }),
  );
}

// ---- Collaboration ------------------------------------------------------------------------------

function collaboration(answer) {
  const d = (answer && answer.data) || {};
  const inv = d.invites || {};
  const sig = d.signals || {};
  const src = (answer && answer.sources) || [];
  return grid(
    panel(
      { title: 'Invitations', note: 'An owner invites a performer by email; the link introduces the two copies. The part itself never comes here.', source: src[0] },
      stats(
        stat('Made', num(inv.created)), stat('Opened', num(inv.opened), pct(inv.openedPercent)),
        stat('Accepted', num(inv.accepted), pct(inv.acceptedPercent)), stat('Withdrawn', num(inv.revoked)), stat('Expired', num(inv.expired)),
      ),
      funnel([
        { label: 'Made', value: inv.created, color: GOLD },
        { label: 'Opened the link', value: inv.opened, color: WARM },
        { label: 'Accepted in the app', value: inv.accepted, color: SILVER },
      ]),
      el('p', { class: 'note', text: 'An invitation is good for 30 days, and making a second one for the same part withdraws the first - so "withdrawn" counts both the owner changing their mind and the owner sending a fresh link.' }),
    ),
    panel(
      { title: 'Invitations per day', note: 'When they were made, and when they were accepted (UTC).', source: src[0] },
      daySeries(inv.perDay, { label: 'Made per day', color: GOLD }),
      daySeries(inv.acceptedPerDay, { label: 'Accepted per day', color: SILVER }),
    ),
    panel(
      { title: 'Direct introductions', note: 'Two copies swapping the few kilobytes it takes to find each other. Sealed: the site cannot read one.', source: src[1] },
      stats(stat('Rows in flight', num(sig.rows)), stat('Connections', num(sig.rooms))),
      el('p', { class: 'note', text: sig.note || '' }),
    ),
  );
}

// ---- Support ---------------------------------------------------------------------------------------

function support(answer) {
  const s = ((answer && answer.data) || {}).support || {};
  const src = (answer && answer.sources) || [];
  const latest = s.latest || [];
  return grid(
    panel(
      { title: 'What people sent us', note: 'Bug reports from inside the app, and messages from the contact page.', source: src.join(' · ') },
      stats(stat('Bug reports', num(s.bugs), '', s.bugs ? 'alarm' : ''), stat('Contact messages', num(s.contacts))),
      el('p', { class: 'note', text: 'Bug reports per day (UTC):' }),
      daySeries(s.bugsPerDay, { label: 'Bug reports per day', color: ALARM }),
      el('p', { class: 'note', text: 'Contact messages per day (UTC):' }),
      daySeries(s.contactsPerDay, { label: 'Messages per day', color: GOLD }),
    ),
    panel(
      { title: 'The latest twenty', note: 'Newest first. Both kinds together, exactly as they arrived.', source: src.join(' · '), wide: true },
      latest.length
        ? el('div', { class: 'feed' }, latest.map((r) => el(
          'article',
          { dataset: { supportItem: r.kind } },
          el(
            'header',
            {},
            el('span', { class: `tag${r.kind === 'bug' ? ' is-alarm' : ''}`, text: r.kind === 'bug' ? 'Bug report' : 'Message' }),
            el('span', { class: 'dim', text: whenText(r.at) }),
            el('span', { class: r.email ? '' : 'dim', text: r.email || 'no address given' }),
            r.subject ? el('span', { class: 'dim', text: `· ${r.subject}` }) : null,
          ),
          el('p', { class: 'said', text: r.text }),
        )))
        : empty('Nobody has written in. That is the good outcome.'),
    ),
  );
}

// ---- Alpha ---------------------------------------------------------------------------------------
//
// The public alpha (site/wix/README.md §13). Every number here came from a usage report, which is
// numbers, dates and short codes - there is no text in one to show.

function alpha(answer, ctx) {
  const a = ((answer && answer.data) || {}).alpha || {};
  const src = (answer && answer.sources) || [];
  const onReward = (ctx && ctx.onReward) || null;
  const testers = a.testers || [];
  const threshold = a.threshold || 20000;
  const pool = a.pool || {};
  return grid(
    panel(
      { title: 'The public alpha', note: 'Keys claimed from the pool, and the app sessions of the accounts that claimed them.', source: src.join(' · ') },
      stats(
        stat('Keys claimed', num(pool.claimed), `of ${num(pool.total)}`),
        stat('Testers reporting', num(testers.length)),
        stat('Sessions', num(a.sessions)),
        stat('Hours in the app', num(a.hours)),
        stat('Qualify for the free year', num(a.qualifying), `${num(threshold)} words recorded`, a.qualifying ? 'gold' : ''),
      ),
    ),
    panel(
      { title: 'Testers', note: `Qualifiers first: ${num(threshold)} or more words of their own book recorded during the alpha. The free year is granted once, from here, and starts the day their pass ends.`, source: src[0], wide: true },
      testers.length
        ? table(testers.map((t) => ({
          dataset: { alphaTester: t.memberId },
          cells: [
            { text: t.email || t.memberId, class: t.qualifies ? 'strong' : '' },
            { text: `${num(t.sessions)} session${t.sessions === 1 ? '' : 's'} · ${num(t.hours)} h`, class: 'dim' },
            { text: t.lastSeen ? `last seen ${whenText(t.lastSeen)}` : '', class: 'dim' },
            { text: t.version || '', class: 'dim mono' },
            { text: `${num(t.words)} words · ${num(t.lines)} lines · ${num(t.books)} book${t.books === 1 ? '' : 's'}`, class: t.qualifies ? 'gold' : 'dim' },
            t.rewarded
              ? { text: 'Free year granted', class: 'gold' }
              : t.qualifies
                ? (onReward
                  ? el('button', { class: 'btn btn-gold', type: 'button', dataset: { alphaReward: t.memberId }, text: 'Grant the free year', onclick: (e) => {
                    const b = e.currentTarget;
                    if (b.dataset.sure !== 'yes') { b.dataset.sure = 'yes'; b.textContent = `Yes, a free year for ${t.email || 'them'}`; return; }
                    b.disabled = true; b.textContent = 'Working…'; onReward(t);
                  } })
                  : { text: 'Qualifies', class: 'gold' })
                : { text: '', class: 'dim' },
          ],
        })), { head: ['Tester', 'Use', 'Seen', 'Version', 'Recorded', 'Free year'] })
        : empty('No alpha account has sent a report yet.'),
    ),
    panel(
      { title: 'What they used', note: 'Every action of every session, summed. One press of Generate is one; one recording saved is one.', source: src[0] },
      rankedBars(a.features, { label: 'Actions by kind', color: GOLD }),
    ),
    panel(
      { title: 'Errors', note: 'By kind: which action failed and the code it answered. Never a message.', source: src[0] },
      rankedBars(a.errors, { label: 'Errors by kind', color: ALARM }),
      el('p', { class: 'note', text: 'Voice services used, by sessions that used them:' }),
      rankedBars(a.providers, { label: 'Voice services', color: SILVER }),
    ),
  );
}

// ---- Audit ---------------------------------------------------------------------------------------

function audit(answer) {
  const a = ((answer && answer.data) || {}).audit || {};
  const src = (answer && answer.sources) || [];
  const rows = a.latest || [];
  return grid(
    panel(
      { title: 'The ledger', note: 'Every Gold desk action, every page of this Console, and every device that was linked or unlinked.', source: src[0] },
      stats(stat('Entries in the window', num(a.total)), stat('Refused', num(a.refused), 'wrong passphrase, a locked desk, a bad signature', a.refused ? 'alarm' : '')),
      daySeries(a.perDay, { label: 'Ledger entries per day', color: GOLD }),
      rankedBars(a.byAction, { label: 'By action', color: SILVER, max: 10 }),
    ),
    panel(
      { title: 'Latest entries', note: 'Newest first.', source: src[0], wide: true },
      rows.length
        ? table(rows.map((r) => ({
          dataset: { audit: r.action },
          cells: [
            { text: whenText(r.at), class: 'dim nowrap' },
            { text: r.action, class: `strong nowrap${r.ok ? '' : ' alarm'}` },
            { text: r.ok ? 'done' : (r.reason || 'refused'), class: r.ok ? 'dim nowrap' : 'alarm nowrap' },
            r.detail || '-',
            { text: r.machineId ? `${r.machineId}…` : '', class: 'dim mono nowrap' },
          ],
        })))
        : empty('Nothing in the ledger for this window.'),
    ),
  );
}

// ---- Devices ---------------------------------------------------------------------------------------

function devices(answer, ctx) {
  const d = (answer && answer.data) || {};
  const rows = d.devices || [];
  const onRevoke = (ctx && ctx.onRevoke) || null;
  const live = rows.filter((r) => !r.revokedAt);
  return grid(
    panel(
      {
        title: 'Linked devices',
        note: `Up to ${d.limit || 5}. Each one has its own key, made in its own browser; unlinking one takes effect on its very next request.`,
        source: (answer && answer.sources && answer.sources[0]) || '',
        wide: true,
      },
      stats(stat('Linked now', num(live.length)), stat('Room for', num(Math.max(0, (d.limit || 5) - live.length)))),
      rows.length
        ? el('div', { class: 'feed' }, rows.map((r) => el(
          'article',
          { dataset: { device: r.deviceId }, class: r.revokedAt ? 'is-off' : '' },
          el(
            'header',
            {},
            el('span', { class: 'strong', text: r.label || 'A device' }),
            r.thisDevice ? el('span', { class: 'tag', text: 'this one' }) : null,
            r.revokedAt ? el('span', { class: 'tag is-alarm', text: 'unlinked' }) : null,
          ),
          el('p', { class: 'note', text: `Linked ${dayText(r.createdAt)}${r.lastSeenAt ? ` · last used ${whenText(r.lastSeenAt)}` : ''} · ${r.deviceId.slice(0, 12)}…` }),
          !r.revokedAt && onRevoke
            ? el('p', {}, el('button', { class: 'btn btn-quiet', type: 'button', dataset: { revoke: r.deviceId }, onclick: () => onRevoke(r), text: r.thisDevice ? 'Unlink this device' : `Unlink ${r.label || 'it'}` }))
            : null,
        )))
        : empty('No device is linked. That cannot be true if you are reading this, so the list could not be read - try again.'),
      el('p', { class: 'note', text: 'Lost a phone? Unlink it here from another device, or delete its row in the Wix CMS under ConsoleDevices. Its key can do nothing afterwards, and nothing it ever held was a secret in the first place - the private half never left it.' }),
    ),
  );
}

const BODY = { overview, downloads, licenses, collaboration, support, alpha, audit, devices };

/** One section, rendered. `ctx` carries the GitHub half and the Devices page's Unlink. */
export function renderSection(section, answer, ctx = {}) {
  const draw = BODY[section] || overview;
  const wrap = el('div', { class: 'section', dataset: { consoleSection: section } });
  wrap.appendChild(draw(answer, ctx));
  const missing = notCollected(answer && answer.notCollected);
  if (missing) wrap.appendChild(missing);
  return wrap;
}
