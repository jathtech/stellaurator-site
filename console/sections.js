// The Numbers pages: Overview, Downloads, Licenses, Collaboration, Support, Alpha, Usage, Audit, Test, Devices.
//
// Every page but Test counts OTHER PEOPLE (site/wix/README.md §14): the back office sets aside the
// owner's own accounts, computers, keys and messages, and every panel that lists them says how many
// with one small line, "N set aside as test activity". The Test page is where they are counted.
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
import { compareVersions, downloadSplit } from './releases.js';

const GOLD = 'var(--gilt)';
const SILVER = 'var(--sterling)';
const WARM = 'var(--candle)';
const ALARM = '#FF7A8A';

const size = (bytes) => (bytes > 0 ? `${(bytes / 1048576).toFixed(0)} MB` : '');

/** The one line a panel carries when the back office set some of its rows aside as the owner's. */
const setAside = (...counts) => {
  const n = counts.reduce((sum, c) => sum + (Number(c) || 0), 0);
  return n > 0 ? el('p', { class: 'caption', dataset: { setAside: String(n) }, text: `${num(n)} set aside as test activity` }) : null;
};

// ---- Overview ------------------------------------------------------------------------------

function overview(answer) {
  const d = (answer && answer.data) || {};
  const a = d.accounts || {};
  const t = d.trials || {};
  const p = d.plans || {};
  const s = d.seats || {};
  const x = d.test || {};
  const src = (answer && answer.sources) || [];
  return grid(
    panel(
      { title: 'Accounts', note: 'Every account on the website, however it was made, except your own.', source: src[0] },
      stats(stat('Accounts', num(a.total)), stat('New today', num(a.new1)), stat('New this week', num(a.new7)), stat('New in 30 days', num(a.new30))),
      daySeries(a.perDay, { label: 'New accounts per day', color: GOLD }),
      setAside(x.accounts),
    ),
    panel(
      { title: 'The free trial', note: 'Seven days of the whole studio, no card. One per person, one per computer.', source: src[1] },
      stats(stat('Started', num(t.started)), stat('Running now', num(t.running)), stat('Ended', num(t.ended)), stat('Later held a plan', num(t.converted), pct(t.conversionPercent))),
      el('div', { class: 'row' }, ring(t.converted, t.started, 'Trial accounts that later held a plan', WARM)),
      el('p', { class: 'note', text: `${num(t.converted)} of ${num(t.started)} accounts that started a trial hold, or have held, a plan or a Gold license. That is a fact about the account, not a claim about why they bought.` }),
      daySeries(t.startedPerDay, { label: 'Trials started per day', color: WARM }),
      setAside(x.trials),
    ),
    panel(
      { title: 'Plans', note: 'Granted plans, paid subscriptions, and perpetual Gold - all as a share of one whole.', source: src[2] },
      stats(stat('Live plans', num(p.live)), stat('Orders ever', num(p.total)), stat('Gold, live', num((p.gold || {}).live), '', 'gold'), stat('Gold, revoked', num((p.gold || {}).revoked))),
      rankedBars(p.kinds, { label: 'Plans by kind', color: GOLD }),
      setAside(x.plans),
    ),
    panel(
      { title: 'Computers', note: 'An install is counted when it signs in or quietly refreshes its lease. Nothing else about it is known.', source: src[4] },
      stats(stat('Active today', num(s.active1)), stat('This week', num(s.active7)), stat('In 30 days', num(s.active30)), stat('Removed by their owners', num(s.removed))),
      el('p', { class: 'note', text: 'By app version, over the computers seen in the last 30 days:' }),
      rankedBars(s.byVersion, { label: 'By version', color: GOLD }),
      el('p', { class: 'note', text: 'By platform:' }),
      rankedBars(s.byPlatform, { label: 'By platform', color: SILVER, max: 6 }),
      daySeries(s.newPerDay, { label: 'New computers per day', color: SILVER }),
      setAside(x.devices),
    ),
  );
}

// ---- Downloads ------------------------------------------------------------------------------
//
// Other people only (site/wix/README.md §14, owner 2026-10-02: "I want my own downloads and tests to
// be excluded from these numbers altogether"). GitHub's counters include every fetch the owner's
// computers and Claude made, and an update check reads latest.yml on every launch - so the headline is
// installers and update checks, each on its own, since the test baseline, less what the owner's
// computers and Claude reported (releases.js othersByKind). GitHub's own counters are shown only as
// GitHub's, per release, the three kinds side by side and never added together.

const SOURCE_SAID = {
  device: 'a reading this device took',
  office: 'a reading the back office kept',
  now: 'the reading taken just now: nothing counts as other people until a later reading shows growth',
};

function downloads(answer, ctx) {
  const dl = (ctx && ctx.downloads) || {};
  const d = (answer && answer.data) || {};
  const t = d.test || {};
  const adoption = d.adoption || {};
  const split = downloadSplit({ github: dl, test: t, days: (ctx && ctx.days) || 30 });
  const others = (k) => (split.ready ? split.kinds[k].others : null);
  const latest = dl.latest || {};
  const live = (adoption.onLatest || 0) + (adoption.behind || 0) + (adoption.unknown || 0);
  const go = (ctx && ctx.go) || null;
  const testLink = go
    ? el('button', { class: 'link', type: 'button', dataset: { goTest: 'yes' }, text: 'the Test page', onclick: () => go('test') })
    : 'the Test page';
  const releases = dl.perRelease || [];
  return grid(
    dl.error ? el('p', { class: 'panel is-alarm is-wide', dataset: { githubError: 'yes' }, text: dl.error }) : null,
    panel(
      {
        title: 'Other people',
        note: 'GitHub\'s count now, less its count at the test baseline, less what your computers and Claude reported fetching since. A download is not an install, and an install is not a sign-in.',
        source: `GitHub releases API, asked by this device; the baseline and your reports from the back office${(answer && answer.sources && answer.sources[1]) ? ` · ${answer.sources[1]}` : ''}`,
      },
      split.ready
        ? null
        : el('p', { class: 'said-line is-alarm', dataset: { noBaseline: 'yes' }, text: 'The test baseline is not set on the back office yet, so nobody\'s downloads can be told apart from yours. Run testActivitySetup in the Wix editor (site/wix/README.md §14).' }),
      stats(
        stat('Installers', num(others('installers')), 'downloaded by other people'),
        stat('Update checks', num(others('feedReads')), 'by other people\'s copies'),
        stat('Newest release', latest.tag || '-', latest.publishedAt ? whenText(latest.publishedAt) : '', 'gold'),
      ),
      el('p', { class: 'note', dataset: { testLine: 'yes' } }, 'Your own and Claude\'s activity are counted on ', testLink, '.'),
      split.ready
        ? el('p', { class: 'caption', text: `Since the test baseline, ${whenText(split.baseline.at)}. Counted from ${SOURCE_SAID[split.baseline.source] || 'a reading'}${split.baseline.source === 'now' ? '' : `, ${whenText(split.baseline.readingAt)}`}.${split.countedCapped ? ' More reports than the back office reads at once: the oldest are not subtracted.' : ''}` })
        : null,
    ),
    panel(
      {
        title: 'Other people per day',
        note: 'The change between two daily readings on this device, less what you and Claude reported in between. Day buckets are UTC.',
        source: split.readingsSince
          ? `${split.readingsSince} daily reading${split.readingsSince === 1 ? '' : 's'} on this device since the baseline`
          : 'No reading on this device since the baseline yet - the first one is being written now.',
      },
      split.ready && split.readingsSince > 1
        ? el('div', {},
          daySeries(split.perDay.installers, { label: 'Installers downloaded by other people, per day', color: GOLD }),
          daySeries(split.perDay.feedReads, { label: 'Update checks by other people\'s copies, per day', color: SILVER }))
        : empty('A per-day line needs two readings on two different days after the baseline. Open this page again tomorrow and it starts drawing.'),
      (d.saved || []).length > 1
        ? el('p', { class: 'caption', text: `The back office has kept ${(d.saved || []).length} daily rows as well, so the baseline survives a new phone.` })
        : null,
    ),
    panel(
      { title: 'Update adoption', note: 'Of the computers that checked in over the last 30 days, how many are running the newest release. Your own computers are not among them.', source: (answer && answer.sources && answer.sources[0]) || '' },
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
      setAside(t.devices),
    ),
    panel(
      {
        title: 'Per release, as GitHub counts it',
        note: 'GitHub\'s own counters: every fetch, yours and Claude\'s included. An installer, a blockmap (the updater reads one or two for a differential download) and an update check (the app reads latest.yml at every launch) are three different things and are never added together.',
        source: 'GitHub releases API',
        wide: true,
      },
      releases.length
        ? table(releases.slice(0, 30).map((r) => ({
          dataset: { release: r.release },
          cells: [
            { text: `${r.release}${r.prerelease ? ' · pre-release' : ''}`, class: 'strong nowrap' },
            { text: size(r.installerSize), class: 'dim nowrap' },
            { text: num(r.installers), class: 'mono right' },
            { text: num(r.blockmaps), class: 'mono right dim' },
            { text: num(r.feedReads), class: 'mono right dim' },
          ],
        })), { head: ['Release', 'Installer', 'Installers', 'Blockmaps', 'Update checks'] })
        : empty('No release assets were read.'),
      el('p', {}, el('a', { class: 'link', href: dl.releasesPage || 'https://github.com', target: '_blank', rel: 'noreferrer', dataset: { releases: 'yes' }, text: 'Open the release page on GitHub' })),
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
  const x = d.test || {};
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
      setAside(x.keys, x.gold),
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
      setAside(x.devices),
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
      setAside(((answer && answer.data && answer.data.test) || {}).invites),
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
  const x = ((answer && answer.data) || {}).test || {};
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
      setAside(x.bugs, x.contacts),
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
  const x = ((answer && answer.data) || {}).test || {};
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
      setAside(x.keys, x.rewards),
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
      setAside(x.sessions),
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

// ---- Usage ---------------------------------------------------------------------------------------
//
// "Help make StellAurator better" (site/wix/README.md §15; docs/USAGE_REPORTING.md): only the installs
// whose person opted in, so every number here is out of them and says so. Controls are named by their
// tour anchor or their name in the app's manifest; a failure's message was scrubbed on the computer and
// again on the back office. Your own installs are set aside like everything else on these pages.

const outcomeCells = (r) => [num(r.done), num(r.stopped), { text: num(r.failed), class: r.failed ? 'alarm' : '' }, num(r.refused)];

function usage(answer) {
  const u = ((answer && answer.data) || {}).usage || {};
  const x = ((answer && answer.data) || {}).test || {};
  const src = (answer && answer.sources) || [];
  const i = u.installs || {};
  const p = u.presses || {};
  const s = u.sessions || {};
  const a = u.app || {};
  const tools = u.tools || [];
  const jobs = u.jobs || [];
  const failures = u.failures || [];
  return grid(
    panel(
      { title: 'Installs reporting', note: 'Installs whose person turned on "Help make StellAurator better". Nobody else sends anything, so every number on this page is out of these.', source: src[1] },
      stats(stat('Reporting in this window', num(i.reporting)), stat('New in this window', num(i.newInWindow))),
      daySeries(i.perDay, { label: 'Installs that started reporting, per day', color: GOLD }),
      el('p', { class: 'note', text: 'By version:' }),
      rankedBars(i.byVersion, { label: 'By version', color: SILVER, max: 8 }),
      setAside(x.installs),
    ),
    panel(
      { title: 'Controls pressed', note: 'Each control by its tour anchor or its name in the app, never the words on the screen.', source: src[0], wide: true },
      stats(stat('Presses', num(p.total))),
      daySeries(p.perDay, { label: 'Presses per day', color: GOLD }),
      el('p', { class: 'note', text: 'Most pressed:' }),
      rankedBars((p.top || []).map((r) => ({ key: r.key, count: r.count, percent: r.percent })), { label: 'Most pressed', color: GOLD, max: 25 }),
      el('p', { class: 'note', text: 'By screen:' }),
      rankedBars(p.byScreen, { label: 'By screen', color: SILVER, max: 12 }),
      setAside(x.rows),
    ),
    panel(
      { title: 'Tools run', note: 'Restoration tools: Find and Run, how each ended, and how many clips they changed.', source: src[0], wide: true },
      tools.length
        ? table(tools.map((t) => ({ dataset: { usageTool: t.tool }, cells: [{ text: `${t.tool}${t.find ? ' (Find)' : ''}`, class: 'strong nowrap' }, num(t.runs), ...outcomeCells(t), num(t.clips)] })), { head: ['Tool', 'Runs', 'Done', 'Stopped', 'Failed', 'Refused', 'Clips changed'] })
        : empty('No tool has been run by anybody who opted in.'),
    ),
    panel(
      { title: 'Exports, generations and voice changes', note: 'An export by its format; a generation or a voice change by the voice service it used.', source: src[0], wide: true },
      jobs.length
        ? table(jobs.map((j) => ({ dataset: { usageJob: j.job }, cells: [{ text: j.job, class: 'strong nowrap' }, j.what || '-', num(j.runs), ...outcomeCells(j)] })), { head: ['Job', 'Format or service', 'Runs', 'Done', 'Stopped', 'Failed', 'Refused'] })
        : empty('No export or generation from anybody who opted in.'),
    ),
    panel(
      { title: 'Failures', note: 'By message, scrubbed: a path, a name, an address, a key or a quote shows as <path>, <name>, <email>, <key> or <quoted>. Where it came from: the window, the engine, or a job.', source: src[0], wide: true },
      failures.length
        ? table(failures.slice(0, 40).map((f) => ({ dataset: { usageFailure: String(f.count) }, cells: [{ text: f.message, class: 'strong' }, num(f.count), num(f.window), num(f.engine), num(f.job), { text: f.lastDay || '', class: 'dim nowrap' }, f.control || '-'] })), { head: ['Message', 'Count', 'Window', 'Engine', 'Job', 'Last day', 'Pressed just before'] })
        : empty('Nothing failed for anybody who opted in.'),
    ),
    panel(
      { title: 'Sessions', note: 'One per time the app was open: how long, which modes were opened, how many books the library held (as a range).', source: src[0] },
      stats(stat('Sessions', num(s.count)), stat('Ended in a crash', num(s.crashed), '', s.crashed ? 'alarm' : ''), stat('Average length', `${num(s.averageMinutes)} min`)),
      el('p', { class: 'note', text: 'Modes opened:' }),
      rankedBars(s.modes, { label: 'Modes opened', color: GOLD, max: 12 }),
      el('p', { class: 'note', text: 'Books in the library:' }),
      rankedBars(s.books, { label: 'Books in the library', color: SILVER, max: 6 }),
    ),
    panel(
      { title: 'The app', note: 'Counted once a session: the version, Windows, the looks installed, the microphone\'s kind (never its name), mono or stereo.', source: src[0] },
      rankedBars(a.versions, { label: 'Version', color: GOLD, max: 6 }),
      rankedBars(a.os, { label: 'Windows', color: SILVER, max: 6 }),
      rankedBars(a.looks, { label: 'Looks installed', color: WARM, max: 14 }),
      rankedBars(a.devices, { label: 'Microphone', color: SILVER, max: 7 }),
      rankedBars(a.channels, { label: 'Mono or stereo', color: SILVER, max: 3 }),
    ),
  );
}

// ---- Audit ---------------------------------------------------------------------------------------

function audit(answer) {
  const a = ((answer && answer.data) || {}).audit || {};
  const x = ((answer && answer.data) || {}).test || {};
  const src = (answer && answer.sources) || [];
  const rows = a.latest || [];
  return grid(
    panel(
      { title: 'The ledger', note: 'Every Gold desk action, every page of this Console, and every device that was linked or unlinked. What you did yourself is test activity; a refusal stays here whoever\'s account it names.', source: src[0] },
      stats(stat('Entries in the window', num(a.total)), stat('Refused', num(a.refused), 'wrong passphrase, a locked desk, a bad signature', a.refused ? 'alarm' : '')),
      daySeries(a.perDay, { label: 'Ledger entries per day', color: GOLD }),
      rankedBars(a.byAction, { label: 'By action', color: SILVER, max: 10 }),
      setAside(x.entries),
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

// ---- Test --------------------------------------------------------------------------------------------
//
// The owner's own activity and Claude's (site/wix/README.md §14), each in its own column, and none of
// it on any other page. What was REPORTED came through the signed door from one of the owner's own
// computers (the app) or from Claude's tool on one; purchases, alpha keys, computers, support messages
// and sign-ins are counted from the records the other pages set aside as the owner's. What GitHub had
// counted before the test baseline is the owner's by definition, and shows under the owner as "before
// the baseline".

const TEST_TILES = [
  ['feedCheck', 'Feed checks', 'feedReads'],
  ['installerDownload', 'Installer downloads', 'installers'],
  ['signIn', 'Sign-ins', ''],
  ['purchase', 'Purchases', ''],
  ['alphaKey', 'Alpha keys', ''],
  ['device', 'Devices', ''],
  ['supportMessage', 'Support messages', ''],
  ['probe', 'Probes', ''],
];
const WHO_SAID = { owner: 'Owner', claude: 'Claude' };

function testColumn(who, column, split) {
  const kinds = (column && column.kinds) || {};
  const before = (asset) => (who === 'owner' && asset && split.ready ? split.kinds[asset].baseline : 0);
  const tiles = TEST_TILES.map(([kind, label, asset]) => {
    const reported = Number(kinds[kind]) || 0;
    const earlier = before(asset);
    if (!reported && earlier) return stat(label, num(earlier), 'before the baseline');
    return stat(label, num(reported), earlier ? `and ${num(earlier)} before the baseline` : '');
  });
  // a kind somebody reported that has no tile of its own still shows, after the eight
  const known = new Set(TEST_TILES.map(([k]) => k));
  const extra = Object.entries(kinds).filter(([k, n]) => !known.has(k) && n > 0).map(([k, n]) => stat(k, num(n)));
  return el('div', { dataset: { testColumn: who } }, stats(...tiles, ...extra));
}

function test(answer, ctx) {
  const d = (answer && answer.data) || {};
  const src = (answer && answer.sources) || [];
  const split = downloadSplit({ github: (ctx && ctx.downloads) || {}, test: d, days: (ctx && ctx.days) || 30 });
  const owner = d.owner || {};
  const claude = d.claude || {};
  const rows = d.latest || [];
  const releases = Object.keys({ ...(split.perRelease || {}), ...(owner.perRelease || {}), ...(claude.perRelease || {}) })
    .sort((a, b) => compareVersions(b, a))
    .map((tag) => ({ tag, gh: (split.perRelease || {})[tag] || { installers: 0, feedReads: 0 }, mine: (owner.perRelease || {})[tag] || 0, theirs: (claude.perRelease || {})[tag] || 0 }))
    .filter((r) => r.gh.installers || r.gh.feedReads || r.mine || r.theirs);
  return grid(
    panel(
      {
        title: 'The test baseline',
        note: 'Everything here is kept out of every other page of this Console. Those pages count other people.',
        source: src[0] || '',
        wide: true,
      },
      d.baseline
        ? el('p', { dataset: { testBaseline: d.baseline.at } }, 'Set ', el('strong', { text: whenText(d.baseline.at) }), '. Every download GitHub counted before then is yours or Claude\'s: nobody else had downloaded StellAurator yet.')
        : el('p', { class: 'said-line is-alarm', dataset: { noBaseline: 'yes' }, text: 'The test baseline is not set on the back office yet. Run testActivitySetup in the Wix editor (site/wix/README.md §14); until then the Downloads page shows no figure for other people.' }),
      el('p', { class: 'note', text: `Your accounts: ${(d.ownerEmails || []).join(', ') || 'none named'} (Config OWNER_EMAILS)${d.ownerAccounts ? `, ${num(d.ownerAccounts)} account${d.ownerAccounts === 1 ? '' : 's'} found` : ''}. Their computers, purchases, keys and messages are yours wherever they appear.` }),
    ),
    panel(
      { title: WHO_SAID.owner, note: 'What your computers reported, and what the other pages set aside as yours. Purchases, alpha keys, computers, support messages and sign-ins are counted from those records.', source: src.slice(1).join(' · ') },
      testColumn('owner', owner, split),
    ),
    panel(
      { title: WHO_SAID.claude, note: 'What Claude reported fetching or probing from your computer (tools/testlog.mjs), signed with that computer\'s key.', source: src[0] || '' },
      testColumn('claude', claude, split),
    ),
    releases.length
      ? panel(
        { title: 'Per release', note: 'What GitHub had counted before the baseline, and what you and Claude reported since.', source: 'GitHub releases API, and the TestActivity collection', wide: true },
        table(releases.slice(0, 30).map((r) => ({
          dataset: { testRelease: r.tag },
          cells: [
            { text: r.tag, class: 'strong nowrap' },
            { text: `${num(r.gh.installers)} installer${r.gh.installers === 1 ? '' : 's'} · ${num(r.gh.feedReads)} feed check${r.gh.feedReads === 1 ? '' : 's'} before the baseline`, class: 'dim' },
            { text: `${num(r.mine)} yours since`, class: 'mono' },
            { text: `${num(r.theirs)} Claude's since`, class: 'mono' },
          ],
        }))),
      )
      : null,
    panel(
      { title: 'The latest fifty', note: 'Newest first, yours and Claude\'s together, as they were reported.', source: src[0] || '', wide: true },
      rows.length
        ? table(rows.map((r) => ({
          dataset: { testRow: r.kind },
          cells: [
            { text: whenText(r.at), class: 'dim nowrap' },
            { text: WHO_SAID[r.who] || r.who, class: `nowrap${r.who === 'claude' ? '' : ' strong'}` },
            { text: r.kind, class: 'nowrap' },
            r.detail || '-',
            { text: r.version || '', class: 'dim mono nowrap' },
          ],
        })), { head: ['When', 'Who', 'Kind', 'Detail', 'Version'] })
        : empty('Nothing has been reported yet. The app reports from one of your own accounts once the back office says it is yours; Claude reports with tools/testlog.mjs.'),
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

const BODY = { overview, downloads, licenses, collaboration, support, alpha, usage, audit, test, devices };

/** One section, rendered. `ctx` carries the GitHub half and the Devices page's Unlink. */
export function renderSection(section, answer, ctx = {}) {
  const draw = BODY[section] || overview;
  const wrap = el('div', { class: 'section', dataset: { consoleSection: section } });
  wrap.appendChild(draw(answer, ctx));
  const missing = notCollected(answer && answer.notCollected);
  if (missing) wrap.appendChild(missing);
  return wrap;
}
