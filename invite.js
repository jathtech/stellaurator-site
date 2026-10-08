// The invitation page's brain (site/invite.html — build spec phase 10d).
//
// A performer gets one email, with one link. This is what the link opens: who is inviting
// them, what to install, and the button that hands the invitation to the app.
//
// The pairing key is in the URL's FRAGMENT (`#k=`). A browser never sends a fragment to a
// server, so the key stays between the two people who are working together — this page reads
// it, puts it in the button's link and in the code you can copy, and asks the back office only
// about the code.
//
// Everything above `start()` is pure, so tests/invite.test.mjs runs THIS file rather than a
// description of it. Nothing here touches the document until the page calls start().

export const STATES = ['fresh', 'opened', 'accepted', 'revoked', 'expired', 'unknown'];

/** What the page says in each of the six states. */
export function inviteView(info, { hasKey = true } = {}) {
  const found = info && info.found;
  const status = found ? String(info.status || 'created') : 'unknown';
  const who = (found && info.performerName) || '';
  const show = (found && info.productionTitle) || 'a production';
  const from = (found && info.inviterName) || '';
  const by = from ? `${from} has` : 'You have been';

  if (!found || status === 'unknown') {
    return {
      state: 'unknown', steps: false, tone: 'error',
      eyebrow: 'Invitation',
      heading: 'This invitation was not recognized.',
      lede: 'The link may have been cut short by an email program. Copy the whole link out of the message and open it again, or ask whoever invited you to send a new one.',
    };
  }
  if (status === 'revoked') {
    return {
      state: 'revoked', steps: false, tone: 'error',
      eyebrow: show,
      heading: 'This invitation was withdrawn.',
      lede: `${from || 'The production'} has withdrawn this invitation. Anything you have already recorded stays on your computer. Ask them for a new invitation if this is a mistake.`,
    };
  }
  if (status === 'expired') {
    return {
      state: 'expired', steps: false, tone: 'error',
      eyebrow: show,
      heading: 'This invitation has expired.',
      lede: `An invitation is good for thirty days. Ask ${from || 'the production'} to send you a new one — it takes them one click.`,
    };
  }
  if (!hasKey) {
    return {
      state: 'unknown', steps: false, tone: 'error',
      eyebrow: show,
      heading: 'Part of this link is missing.',
      lede: 'The address is missing the part after the # sign, which is what connects the two copies of StellAurator. Copy the whole link out of the email and open it again.',
    };
  }
  if (status === 'accepted') {
    return {
      state: 'accepted', steps: true, tone: 'ok',
      eyebrow: show,
      heading: 'You are connected. Your part is on its way.',
      lede: `Open StellAurator and leave it open: ${from || 'the production'} can send your part straight to your computer now. If you are setting up a second computer, ask them for a new invitation — one invitation is for one computer.`,
    };
  }
  return {
    state: status === 'opened' ? 'opened' : 'fresh', steps: true, tone: '',
    eyebrow: show,
    heading: who ? `${who} — you have been invited to record.` : 'You have been invited to record.',
    lede: `${by} invited you to record a part in “${show}”. StellAurator is free for performers: no account, no card, nothing to pay. Three steps and you are recording.`,
  };
}

/** `?c=PART-XXXX-XXXX#k=<key>` — and the key is only ever read here, in the browser. */
export function readInviteUrl(href) {
  let url;
  try { url = new URL(String(href || '')); } catch { return { code: '', key: '' }; }
  const code = (url.searchParams.get('c') || '').trim().toUpperCase();
  const fragment = /(?:^|[#&])k=([^&]*)/.exec(url.hash || '');
  let key = '';
  try { key = decodeURIComponent((fragment && fragment[1]) || ''); } catch { key = (fragment && fragment[1]) || ''; }
  return { code, key: key.trim() };
}

/**
 * The link that opens the app. The key is in the query AS WELL as the fragment, because
 * Windows sometimes drops a fragment when it hands a protocol link to a program — and this
 * link never leaves the person's own computer, so the query costs nothing here.
 */
export const protocolLink = (code, key) =>
  `stellaurator://invite?c=${encodeURIComponent(code)}&k=${encodeURIComponent(key)}#k=${encodeURIComponent(key)}`;

/** The one thing that always works: paste it into the app. */
export const connectionCode = (code, key) => `${code}.${key}`;

// ---- the page ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

async function askInfo(endpoint, code) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`The site replied ${res.status}`);
  return res.json();
}

export async function start() {
  const { code, key } = readInviteUrl(window.location.href);
  const cfg = (window.STELLA_CONFIG || {});
  const endpoint = cfg.inviteEndpoint || (cfg.accountSite ? `${cfg.accountSite}/_functions/inviteInfo` : '');
  const downloads = cfg.accountSite ? `${cfg.accountSite}/downloads` : 'account.html';

  const paint = (view) => {
    el('eyebrow').textContent = view.eyebrow;
    el('heading').textContent = view.heading;
    el('lede').textContent = view.lede;
    document.body.dataset.state = view.state;
    el('steps').hidden = !view.steps;
    el('nosteps').hidden = !!view.steps;
  };

  el('download').href = downloads;
  if (code && key) {
    el('open').href = protocolLink(code, key);
    el('code').textContent = connectionCode(code, key);
  }

  if (!code) { paint(inviteView(null, { hasKey: !!key })); return; }
  if (!endpoint) {
    // The site is not connected to the back office yet: the three steps still work, because
    // the code and the key are in the link and the app is what checks them.
    paint(inviteView({ found: true, status: 'created', productionTitle: 'a production' }, { hasKey: !!key }));
    return;
  }
  try {
    paint(inviteView(await askInfo(endpoint, code), { hasKey: !!key }));
  } catch {
    paint(inviteView({ found: true, status: 'created', productionTitle: 'a production' }, { hasKey: !!key }));
  }
}

// Copy buttons: one handler for every [data-copy-target] on the page.
export function wireCopy() {
  for (const button of document.querySelectorAll('[data-copy-target]')) {
    button.addEventListener('click', async () => {
      const source = document.getElementById(button.dataset.copyTarget);
      if (!source) return;
      const was = button.textContent;
      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        button.textContent = 'Copied';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(source);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        button.textContent = document.execCommand('copy') ? 'Copied' : 'Select and copy';
      }
      setTimeout(() => { button.textContent = was; }, 2200);
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('heading')) {
  wireCopy();
  start();
}
