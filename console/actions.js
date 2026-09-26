// Account control: one account at a time, every change confirmed, every change in the ledger.
//
// Owner, 2026-09-20: "control certain aspects of account control without opening the actual app
// itself."
//
// The shape of this page is the argument for it being safe. There is no list of accounts to act on
// and no bulk anything: you type an email, you read what that account actually is, and only then do
// buttons appear. Each one asks a second time, in words that say what will happen ("their copy turns
// read-only at its next check-in; nothing of theirs is deleted"), and each one writes a line the
// Audit page can show back to you a year later.
//
// Nothing here can reach a book. Not because it is filtered - because no manuscript, line, recording
// or title has ever existed on the back office to reach.
import { el, dayText, empty, grid, num, panel, stat, stats, table } from './charts.js';

const said = (node, text, tone) => {
  node.textContent = '';
  if (text) node.appendChild(el('p', { class: `said-line${tone ? ` is-${tone}` : ''}`, text }));
};

/**
 * A button that asks twice. The first press turns it into the question, in the words that describe
 * what is about to happen; the second press sends `confirm: true`, which the back office checks for
 * as well, so a request built by hand cannot skip the step the owner is meant to have read.
 */
function confirmButton({ label, question, okLabel, danger, dataset }, run) {
  const wrap = el('span', { class: 'confirm' });
  const ask = el('button', { class: `btn${danger ? ' btn-danger' : ' btn-quiet'}`, type: 'button', dataset: dataset || {}, text: label });
  ask.addEventListener('click', () => {
    wrap.textContent = '';
    wrap.appendChild(el(
      'span',
      { class: 'confirm is-open' },
      el('span', { class: 'note', text: question }),
      el('button', { class: `btn${danger ? ' btn-danger' : ' btn-gold'}`, type: 'button', dataset: { confirm: (dataset && dataset.action) || 'yes' }, text: okLabel || 'Yes, do it', onclick: () => { wrap.textContent = ''; wrap.appendChild(el('span', { class: 'note', text: 'Working…' })); run(); } }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Cancel', onclick: () => { wrap.textContent = ''; wrap.appendChild(ask); } }),
    ));
  });
  wrap.appendChild(ask);
  return wrap;
}

const field = (label, value, dim) => el('p', { class: 'kv' }, el('span', { class: 'kv-key', text: label }), el('span', { class: dim ? 'dim' : '', text: value }));

// ---- the account card ---------------------------------------------------------------------------

function accountCard(view, { act, refresh, note }) {
  const c = view.computers || {};
  const t = view.trial;
  const g = view.gold;
  const days = el('input', { class: 'input is-tiny', type: 'number', min: '1', max: '30', value: '7', dataset: { extendDays: 'yes' }, 'aria-label': 'Days to add' });

  return panel(
    { title: view.email, note: `${view.plan}${view.blocked ? ' · BLOCKED' : ''}${view.createdAt ? ` · account made ${dayText(view.createdAt)}` : ''}`, wide: true },
    el('div', { dataset: { account: view.email } }),
    stats(
      stat('Plan', view.perpetual ? 'Gold' : view.plan, '', view.perpetual ? 'gold' : ''),
      stat('Computers', num(c.live), `${num(c.ever)} ever`),
      stat('Orders ever', num(view.orders)),
      stat('Invitations sent', num((view.invitations || []).length)),
    ),

    // ---- the trial ------------------------------------------------------------------------
    el(
      'div',
      { class: 'block' },
      el('h3', { text: 'The free trial' }),
      t
        ? field('Trial', `${t.running ? 'running' : 'ended'} · started ${dayText(t.startedAt)} · ends ${dayText(t.expiresAt)}`)
        : el('p', { class: 'note', text: 'This account has never started a free trial.' }),
      t
        ? el(
          'div',
          { class: 'row is-tight' },
          days,
          el('span', { class: 'note', text: 'more days' }),
          confirmButton({
            label: 'Extend the trial',
            question: 'Add those days to this trial? A running trial keeps the hours it has left; an ended one starts again from today.',
            okLabel: 'Extend it',
            dataset: { action: 'account:extendTrial' },
          }, () => act('account:extendTrial', { email: view.email, days: Number(days.value) || 0, confirm: true })),
        )
        : null,
    ),

    // ---- the computers ---------------------------------------------------------------------
    el(
      'div',
      { class: 'block' },
      el('h3', { text: 'Computers' }),
      (c.rows || []).length
        ? table((c.rows || []).map((r) => ({
          dataset: { computer: r.seatId },
          cells: [
            { text: r.name || 'a computer', class: r.removed ? 'dim' : 'strong' },
            { text: `${r.platform || ''} · ${r.appVersion || 'version unknown'}`, class: 'dim' },
            { text: r.lastSeen ? `last seen ${dayText(r.lastSeen)}` : '', class: 'dim' },
            r.removed
              ? { text: 'removed', class: 'dim' }
              : confirmButton({
                label: 'Remove',
                question: `Free this seat? ${view.email} signs out on ${r.name || 'that computer'} at its next check-in and can sign in on it again whenever a place is free. Nothing of theirs is deleted.`,
                okLabel: 'Free the seat',
                dataset: { action: 'account:removeComputer' },
              }, () => act('account:removeComputer', { email: view.email, seatId: r.seatId, confirm: true })),
          ],
        })))
        : empty('No computer has ever signed in on this account.'),
    ),

    // ---- Gold -------------------------------------------------------------------------------
    g
      ? el(
        'div',
        { class: 'block' },
        el('h3', { text: 'Gold license' }),
        field('Granted', `${dayText(g.grantedAt)} · ${g.source || 'gift'}${g.note ? ` · ${g.note}` : ''}`),
        g.revokedAt ? field('Revoked', `${dayText(g.revokedAt)} · ${g.revokedReason || ''}`, true) : null,
        g.live
          ? confirmButton({
            label: 'Revoke this Gold license',
            question: 'Revoke it? Their copy turns read-only the next time it is online - their books still open and play, and nothing of theirs is deleted. You can give it back later.',
            okLabel: 'Revoke it',
            danger: true,
            dataset: { action: 'gold:revoke' },
          }, () => act('gold:revoke', { id: g.id, reason: 'license abuse', confirm: true }))
          : confirmButton({
            label: 'Give the license back',
            question: 'Reinstate it? The full studio comes back at their next check-in.',
            okLabel: 'Give it back',
            dataset: { action: 'gold:reinstate' },
          }, () => act('gold:reinstate', { id: g.id, confirm: true })),
      )
      : null,

    // ---- blocking ------------------------------------------------------------------------------
    el(
      'div',
      { class: 'block' },
      el('h3', { text: 'Signing in' }),
      el('p', { class: 'note', text: 'A blocked account cannot sign in and holds no lease. Their own books still open and play on their own computer, and nothing of theirs is deleted. It can be lifted at any time.' }),
      view.blocked
        ? confirmButton({
          label: 'Let them sign in again',
          question: `Unblock ${view.email}?`,
          okLabel: 'Unblock',
          dataset: { action: 'account:unblock' },
        }, () => act('account:unblock', { email: view.email, confirm: true }))
        : confirmButton({
          label: 'Block this account',
          question: `Block ${view.email}? They cannot sign in afterwards, and their copy turns read-only at its next check-in.`,
          okLabel: 'Block them',
          danger: true,
          dataset: { action: 'account:block' },
        }, () => act('account:block', { email: view.email, confirm: true })),
    ),

    // ---- what they have sent out ------------------------------------------------------------------
    (view.invitations || []).length
      ? el(
        'div',
        { class: 'block' },
        el('h3', { text: 'Performers they invited' }),
        table(view.invitations.map((i) => ({ cells: [i.performerName || 'a performer', { text: i.status, class: 'dim' }, { text: dayText(i.createdAt), class: 'dim' }] }))),
        el('p', { class: 'note', text: 'Withdrawing one of these is deliberately not here: the production owns its invitations and withdraws them in its own copy. An owner doing it from this page on the strength of an email would leave nothing on the record but that email.' }),
      )
      : null,

    (view.keys || []).length
      ? el('div', { class: 'block' }, el('h3', { text: 'Invitation keys they redeemed' }), table(view.keys.map((k) => ({ cells: [{ text: k.key, class: 'mono' }, { text: k.batch, class: 'dim' }, { text: k.usedAt ? dayText(k.usedAt) : '', class: 'dim' }] })))) : null,

    el('p', {}, el('button', { class: 'btn btn-quiet', type: 'button', text: 'Read this account again', onclick: refresh })),
    note,
  );
}

// ---- the page --------------------------------------------------------------------------------------

/**
 * `send(action, extra)` is console.js's signed call. Everything on this page goes through it, and
 * every answer either replaces the card or turns into one sentence under the button.
 */
export function renderActions({ send, state, onState }) {
  const page = el('div', { class: 'section', dataset: { consoleSection: 'actions' } });
  const message = el('div', { class: 'says', dataset: { actionSays: 'yes' } });
  const cardHolder = el('div', { dataset: { accountCard: 'yes' } });
  const email = el('input', { class: 'input', type: 'email', inputmode: 'email', autocomplete: 'off', placeholder: 'customer@example.com', dataset: { lookupEmail: 'yes' }, value: (state && state.email) || '' });

  const act = async (action, extra) => {
    said(message, 'Working…');
    try {
      const r = await send(action, extra);
      if (r.account) show(r.account);
      if (r.made && r.made.length) showKeys(r.made);
      said(message, r.said || 'Done.', 'ok');
      if (onState) onState({ email: email.value });
    } catch (e) {
      said(message, e.message, 'alarm');
    }
  };

  const find = async () => {
    said(message, 'Looking…');
    cardHolder.textContent = '';
    try {
      const r = await send('account:find', { email: email.value.trim().toLowerCase() });
      show(r.account);
      said(message, '');
      if (onState) onState({ email: email.value });
    } catch (e) {
      said(message, e.message, 'alarm');
    }
  };

  function show(view) {
    cardHolder.textContent = '';
    if (!view) return;
    cardHolder.appendChild(accountCard(view, { act, refresh: find, note: null }));
  }

  // ---- Gold keys and invitation keys ----------------------------------------------------------
  const keyHolder = el('div', { dataset: { keyResults: 'yes' } });
  function showKeys(made) {
    keyHolder.textContent = '';
    keyHolder.appendChild(el(
      'div',
      { class: 'fresh-keys' },
      el('p', { class: 'note', text: 'Made just now. Copy them before you leave this page - they are listed afterwards, but this is the only time they are all in one place.' }),
      made.map((k) => el('p', { class: 'mono big', dataset: { freshKey: k }, text: k })),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Copy them all', onclick: () => navigator.clipboard.writeText(made.join('\n')).catch(() => {}) }),
    ));
  }

  const goldCount = el('input', { class: 'input is-tiny', type: 'number', min: '1', max: '20', value: '1', 'aria-label': 'How many Gold keys' });
  const goldFor = el('input', { class: 'input', type: 'text', placeholder: 'Who is it for? (your list only)', 'aria-label': 'Who the key is for' });
  const goldKind = el('select', { class: 'input is-small', 'aria-label': 'A gift or a sale' }, el('option', { value: 'gift', text: 'A gift' }), el('option', { value: 'sale', text: 'A sale' }));

  const batchCount = el('input', { class: 'input is-tiny', type: 'number', min: '1', max: '100', value: '10', 'aria-label': 'How many invitation keys' });
  const batchPlan = el('input', { class: 'input', type: 'text', placeholder: 'Plan id, from Pricing Plans', 'aria-label': 'Plan id' });
  const batchName = el('input', { class: 'input', type: 'text', placeholder: 'Batch name (optional)', 'aria-label': 'Batch name' });
  // The public alpha's end: the phrase is typed out, and the back office checks it again.
  const alphaPhrase = el('input', { class: 'input', type: 'text', autocomplete: 'off', placeholder: 'Type END THE ALPHA', 'aria-label': 'Type END THE ALPHA to end the alpha', dataset: { alphaPhrase: 'yes' } });

  page.appendChild(grid(
    panel(
      { title: 'Find an account', note: 'Everything on this page is about one account, and you read it before anything can be pressed.', wide: true },
      el(
        'form',
        { class: 'row', onsubmit: (e) => { e.preventDefault(); find(); } },
        email,
        el('button', { class: 'btn btn-gold', type: 'submit', dataset: { lookupGo: 'yes' }, text: 'Find' }),
      ),
      message,
      cardHolder,
    ),
    panel(
      { title: 'Gold licenses', note: 'Perpetual copies, yours to give or sell. A key is redeemed once, by one person, with an email and nothing else.' },
      el('div', { class: 'row is-tight' }, goldCount, goldKind),
      goldFor,
      confirmButton({
        label: 'Make Gold keys',
        question: 'Make them? A Gold key is a perpetual license once it is redeemed. An unused one can be voided.',
        okLabel: 'Make them',
        dataset: { action: 'gold:create' },
      }, () => act('gold:create', { count: Number(goldCount.value) || 1, kind: goldKind.value, recipient: goldFor.value, confirm: true })),
      el('p', {}, el('button', { class: 'btn btn-quiet', type: 'button', dataset: { goldList: 'yes' }, text: 'List keys and licenses', onclick: async () => {
        said(message, 'Reading…');
        try {
          const r = await send('gold:list', {});
          keyHolder.textContent = '';
          keyHolder.appendChild(goldTable(r, act));
          said(message, '');
        } catch (e) { said(message, e.message, 'alarm'); }
      } })),
      keyHolder,
    ),
    panel(
      { title: 'Invitation keys', note: 'A batch of alpha passes for a plan that already exists on the site. This never makes a plan: a plan is a price, and a price is yours to name.' },
      el('div', { class: 'row is-tight' }, batchCount, batchPlan),
      batchName,
      confirmButton({
        label: 'Make the batch',
        question: 'Make that many keys? They are listed afterwards under their batch name.',
        okLabel: 'Make them',
        dataset: { action: 'keys:create' },
      }, () => act('keys:create', { count: Number(batchCount.value) || 0, planId: batchPlan.value.trim(), batch: batchName.value.trim(), confirm: true })),
      el('p', {}, el('button', { class: 'btn btn-quiet', type: 'button', dataset: { keysList: 'yes' }, text: 'List the keys and who used them', onclick: async () => {
        said(message, 'Reading…');
        try {
          const r = await send('keys:list', { batch: batchName.value.trim() });
          keyHolder.textContent = '';
          keyHolder.appendChild(panel(
            { title: `Invitation keys${batchName.value.trim() ? ` · ${batchName.value.trim()}` : ''}`, note: `${num(r.used)} of ${num(r.made)} redeemed.` },
            (r.keys || []).length
              ? table((r.keys || []).slice(0, 60).map((k) => ({ cells: [{ text: k.key, class: 'mono' }, { text: k.batch, class: 'dim' }, { text: k.usedBy || 'not used', class: k.usedBy ? '' : 'dim' }, { text: k.usedAt ? dayText(k.usedAt) : '', class: 'dim' }] })))
              : empty('No invitation keys have been made yet.'),
          ));
          said(message, '');
        } catch (e) { said(message, e.message, 'alarm'); }
      } })),
    ),
    // The public alpha (site/wix/README.md §13). Ending it cancels every alpha pass the pool gave out,
    // at once, so it asks for the phrase typed out as well as the second press.
    panel(
      { title: 'The public alpha', note: 'End the alpha: the pool closes, every unused key is voided, and every alpha pass it gave out is canceled at once. Those accounts turn read-only at their next check-in, like a trial that has ended. Their books stay on their computers.' },
      alphaPhrase,
      confirmButton({
        label: 'End the alpha',
        question: 'End the alpha now? Every alpha pass from the pool is canceled at once. This cannot be undone from here.',
        okLabel: 'End it',
        danger: true,
        dataset: { action: 'alpha:end' },
      }, () => act('alpha:end', { phrase: alphaPhrase.value.trim(), confirm: true })),
    ),
  ));
  if ((state && state.email) || '') find();
  return page;
}

function goldTable(r, act) {
  const keys = (r.keys || []).filter((k) => !k.usedAt);
  const licences = r.licences || [];
  return panel(
    { title: 'The Gold desk', note: `${num(keys.length)} key${keys.length === 1 ? '' : 's'} not used yet · ${num(licences.filter((l) => !l.revokedAt).length)} live license${licences.filter((l) => !l.revokedAt).length === 1 ? '' : 's'}`, wide: true },
    keys.length
      ? table(keys.map((k) => ({
        dataset: { goldKey: k.key },
        cells: [
          { text: k.key, class: 'mono' },
          { text: `${k.recipient || '-'}${k.note ? ` · ${k.note}` : ''}`, class: 'dim' },
          { text: `${k.kind || 'gift'} · ${dayText(k.createdAt)}`, class: 'dim' },
          confirmButton({ label: 'Void', question: `Void ${k.key}? It has not been used; after this it never can be.`, okLabel: 'Void it', danger: true, dataset: { action: 'gold:void' } }, () => act('gold:void', { id: k.id, confirm: true })),
        ],
      })))
      : empty('No unused Gold keys.'),
    licences.length
      ? table(licences.map((l) => ({
        dataset: { goldLicence: l.email },
        cells: [
          { text: l.email, class: l.revokedAt ? 'dim' : 'strong' },
          { text: `${l.source === 'owner' ? 'yours' : l.source} · ${dayText(l.grantedAt)}`, class: 'dim' },
          { text: `${l.computers} computer${l.computers === 1 ? '' : 's'} so far${l.flagged ? ' - worth a look' : ''}`, class: l.flagged ? 'alarm' : 'dim' },
          l.revokedAt
            ? confirmButton({ label: 'Give it back', question: `Reinstate ${l.email}'s license?`, okLabel: 'Give it back', dataset: { action: 'gold:reinstate' } }, () => act('gold:reinstate', { id: l.id, confirm: true }))
            : l.source === 'owner'
              ? { text: 'yours', class: 'dim' }
              : confirmButton({ label: 'Revoke', question: `Revoke ${l.email}'s Gold license? Their copy turns read-only the next time it is online; nothing of theirs is deleted and you can give it back.`, okLabel: 'Revoke it', danger: true, dataset: { action: 'gold:revoke' } }, () => act('gold:revoke', { id: l.id, reason: 'license abuse', confirm: true })),
        ],
      })))
      : empty('No Gold licenses have been granted.'),
    el('p', { class: 'note', text: `Nothing is ever revoked automatically. More than ${r.abuseOver || 6} computers ever is a flag for you to judge, and revoking never deletes anyone's work.` }),
  );
}
