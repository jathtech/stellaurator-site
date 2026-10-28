// Shared chrome for every page: the header, the signed-in state, config links.
(() => {
  const cfg = window.STELLA_CONFIG || {};
  const page = document.body.dataset.page || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function readAccount() {
    try {
      const a = JSON.parse(localStorage.getItem('stella.account') || 'null');
      return a && a.email && (!a.exp || a.exp * 1000 > Date.now()) ? a : null;
    } catch { return null; }
  }
  const account = readAccount();

  // Refer an author (site/wix/README.md section 18): a link https://stellaurator.com/?ref=CODE is kept in
  // this browser for 30 days and added to every account-site link (the trial, the plans, Sign in) as
  // ?ref=CODE, so the account site can record the referral once the visitor has an account. The code is
  // eight characters with no look-alikes; anything else is ignored.
  const REF_KEY = 'stella.ref';
  const REF_DAYS = 30;
  const REF_SHAPE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
  const keptRef = () => {
    let fresh = '';
    try { fresh = String(new URLSearchParams(window.location.search).get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); } catch { fresh = ''; }
    try {
      if (REF_SHAPE.test(fresh)) localStorage.setItem(REF_KEY, JSON.stringify({ code: fresh, at: Date.now() }));
      const k = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
      if (k && REF_SHAPE.test(String(k.code || '')) && Date.now() - Number(k.at) <= REF_DAYS * 86400000) return String(k.code);
      if (k) localStorage.removeItem(REF_KEY);
    } catch { /* storage refused: the link still works this once */ }
    return REF_SHAPE.test(fresh) ? fresh : '';
  };
  const ref = keptRef();
  const withRef = (href) => {
    if (!ref || !href || !cfg.accountSite) return href;
    try {
      const u = new URL(href, window.location.href);
      if (u.origin !== new URL(cfg.accountSite).origin) return href;
      u.searchParams.set('ref', ref);
      return u.toString();
    } catch { return href; }
  };

  // A conventional bar: what it is, how it works, what it costs, questions - then Sign in (straight to
  // the account; Wix asks for the password first) and the one action that matters, the download (owner,
  // 2026-10-13: "a simple download button ... easy to see, easy to find"). Terms, privacy and contact
  // live in the footer.
  const home = page === 'home' ? '' : './';
  // The home page is the short version (the promise, the results, how it works, the price); the
  // detail lives on its own pages (owner 2026-10-10: the homepage substantially shorter, the
  // secondary features moved off it, a page for narrators).
  // The bar carries the four a visitor needs (the website audit of 2026-10-16: product, demos, price,
  // help) and, since 2026-10-26, the open beta; the audience and detail pages sit under More. The alpha was
  // never in the bar: it was reached from the footer and by its own address, stellaurator.com/alpha/.
  const links = [
    ['studio.html', 'The studio', 'studio'],
    // The eight recorded demos (site/demos.html).
    ['demos.html', 'Demos', 'demos'],
    ['pricing.html', 'Pricing', 'pricing'],
    // The open beta (owner, 2026-10-26: "add a menu button for the beta"): the free key and the beta prices.
    ['beta/', 'Open beta', 'beta'],
    ['guides/', 'Guides', 'guides'],
  ];
  const more = [
    ['narrators.html', 'For narrators', 'narrators'],
    ['voices.html', 'Voices', 'voices'],
    // Books made with StellAurator (site/books.html): authors' audiobooks, free to list, no commission.
    ['books.html', 'Books', 'books'],
    // Every question answered (site/faq.html), how the ways of making an audiobook compare, and the words
    // of the trade (2026-10-22, the search and AI-assistant pass).
    ['faq.html', 'FAQ', 'faq'],
    ['compare.html', 'Compare', 'compare'],
    ['glossary.html', 'Glossary', 'glossary'],
  ];
  const link = ([href, label, id]) => `<a href="${href}"${id === 'beta' ? ' data-from="menu"' : ''}${id && id === page ? ' aria-current="page"' : ''}>${label}</a>`;
  // on a page that sits under More, the summary is lit as the current place (data-current); it used to
  // be `open`, which also dropped the whole list over the page's heading on every one of those pages
  const moreOpen = more.some(([, , id]) => id && id === page);
  const mount = document.querySelector('[data-nav]');
  if (mount) {
    const header = document.createElement('header');
    header.className = 'nav';
    header.innerHTML = `<div class="wrap">
      <a class="brand" href="./" aria-label="StellAurator home"><img class="mark" src="assets/logo.png" alt=""><img class="word" src="assets/wordmark.png" alt="StellAurator"></a>
      <button class="nav-menu" type="button" aria-expanded="false" aria-controls="nav-pages"><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Menu</button>
      <nav id="nav-pages" aria-label="Pages">${links.map(link).join('')}<details class="nav-more"${moreOpen ? ' data-current="page"' : ''}><summary>More</summary><div class="nav-more-list">${more.map(link).join('')}</div></details></nav>
      <a class="nav-signin" href="${cfg.accountSite ? `${cfg.accountSite}/account` : 'account.html'}"${page === 'account' ? ' aria-current="page"' : ''}>${account ? esc(account.name || 'Account') : 'Sign in'}</a>
      <a class="btn btn-gold nav-account" href="/download.html" data-download-page${page === 'download' ? ' aria-current="page"' : ''}>Download</a>
    </div>`;
    mount.replaceWith(header);
    const signin = header.querySelector('.nav-signin');
    if (signin) signin.href = withRef(signin.href);
    // A narrow window (under about 1,080 pixels, including a wide window with Windows display scaling)
    // has no room for the page links: the Menu button opens them as a list under the bar.
    const menuBtn = header.querySelector('.nav-menu');
    const setMenu = (open) => { header.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
    header.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) setMenu(false); });
  }

  // The open beta offer (owner, 2026-10-26: "why don't we offer the beta as a popup after they've viewed the
  // website for a minute, or if they try to click away? add a menu button for the beta as well"; the menu button
  // is the bar's Open beta link, above). WHO: a reader browsing, once, and not again for 14 days (this browser
  // keeps the time it was shown, nothing else); not on the beta page itself, the account, the license
  // agreement, the download page, an invitation, the contact form or the Mac waitlist; never someone signed in;
  // never inside a frame. WHEN: after the website has been in front of the reader for a minute (the seconds add
  // up across the pages of one visit and stop while the tab is hidden), or, with a mouse, when the pointer
  // leaves through the top of the window, toward the tabs and the close button, after 8 seconds there; never
  // while another dialog is open or a field has the keyboard. ?betaoffer=now shows it at once, to look at it.
  // WHAT: a short offer to join the beta and the reason we ask (owner, 2026-10-26: "don't use the beta as a sales
  // device. Ask people to join the beta because we want to make something good", then "the popup should be an
  // offer to join the beta. The page itself is fine to show all the details"): no price, no "free", no count of
  // keys left; the beta page it opens holds every detail. It shows only while there is a key to claim, which the
  // count the beta page reads says (GET <accountSite>/_functions/betaStatus); the beta ended or every key taken,
  // nothing; no answer, the offer.
  const BETA_OFFER = {
    after: 60, armExit: 8, quietDays: 14,
    skip: ['beta', 'account', 'terms', 'download', 'invite', 'contact', 'coming'],
    memory: 'stella.betaOffer', seconds: 'stella.siteSeconds', counted: 'stella.betaStatus',
  };
  const betaOfferAllowed = (o) => {
    if (o.framed) return false;
    if (o.forced) return true;
    if (o.signedIn || o.shownThisVisit || BETA_OFFER.skip.includes(o.page)) return false;
    return !(o.shownAt && o.now - o.shownAt < BETA_OFFER.quietDays * 86400000);
  };
  const betaOfferWords = (status) => {
    // the beta ended, closed, or every key taken: nothing to join. No answer: the offer, which the beta page keeps honest.
    if (status && (status.ended || status.open === false || !(Number(status.left) > 0))) return null;
    return {
      title: 'Join the beta',
      lines: [
        'We would love to see how well StellAurator works for you and hear your feedback.',
        'Use the whole studio on your own book, and tell us what breaks, what confuses you, and what you would change.',
      ],
      go: { label: 'Join the beta', href: '/beta/' },
    };
  };
  let betaPop = null;
  const showBetaOffer = (how, words) => {
    const before = document.activeElement;
    betaPop = document.createElement('div');
    betaPop.className = 'beta-pop';
    betaPop.setAttribute('role', 'dialog');
    betaPop.setAttribute('aria-modal', 'true');
    betaPop.setAttribute('aria-labelledby', 'beta-pop-title');
    betaPop.setAttribute('data-how', how);
    betaPop.innerHTML = '<div class="frame is-lit panel beta-pop-box">'
      + '<button class="beta-pop-close" type="button" aria-label="Close" data-beta-close>&#x2715;</button>'
      + '<p class="eyebrow">Open beta</p>'
      + `<h2 class="title" id="beta-pop-title">${esc(words.title)}</h2>`
      + words.lines.map((l) => `<p>${esc(l)}</p>`).join('')
      + '<div class="beta-pop-actions">'
      + `<a class="btn btn-gold" href="${esc(words.go.href)}" data-beta-go>${esc(words.go.label)}</a>`
      + '<button class="btn btn-line" type="button" data-beta-close>Not now</button>'
      + '</div></div>';
    const close = () => {
      if (!betaPop) return;
      betaPop.remove();
      betaPop = null;
      document.body.classList.remove('lightbox-open');
      document.removeEventListener('keydown', onKey);
      try { if (before && before.focus) before.focus(); } catch { /* focus is a courtesy */ }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !betaPop) return;
      const items = [...betaPop.querySelectorAll('a[href], button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    betaPop.addEventListener('click', (e) => { if (e.target === betaPop || e.target.closest('[data-beta-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(betaPop);
    document.body.classList.add('lightbox-open');
    try { betaPop.querySelector('[data-beta-go]').focus(); } catch { /* focus is a courtesy */ }
  };
  const betaOfferStart = () => {
    let framed = false;
    try { framed = window.top !== window.self; } catch { framed = true; }
    let forced = false;
    try { forced = new URLSearchParams(window.location.search).get('betaoffer') === 'now'; } catch { forced = false; }
    let shownAt = 0;
    try { shownAt = Number((JSON.parse(localStorage.getItem(BETA_OFFER.memory) || 'null') || {}).at) || 0; } catch { shownAt = 0; }
    let shownThisVisit = false;
    try { shownThisVisit = sessionStorage.getItem(BETA_OFFER.memory) === 'shown'; } catch { shownThisVisit = false; }
    if (!betaOfferAllowed({ page, signedIn: !!account, framed, forced, shownThisVisit, shownAt, now: Date.now() })) return;

    // Whether a key is left, asked once after five seconds (a visitor who leaves sooner costs the back office
    // nothing) and kept for the visit; no answer is the invitation, which the beta page keeps honest.
    let status = null;
    let asked = false;
    const askCount = () => {
      if (asked) return;
      asked = true;
      try {
        const k = JSON.parse(sessionStorage.getItem(BETA_OFFER.counted) || 'null');
        if (k && k.status && Date.now() - Number(k.at) < 300000) { status = k.status; return; }
      } catch { /* ask */ }
      const site = cfg.accountSite || 'https://account.stellaurator.com';
      const stop = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => { if (stop) stop.abort(); }, 4000);
      fetch(`${site}/_functions/betaStatus`, { cache: 'no-store', signal: stop ? stop.signal : undefined })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (!s || typeof s !== 'object' || !Number(s.total)) return;
          status = s;
          try { sessionStorage.setItem(BETA_OFFER.counted, JSON.stringify({ at: Date.now(), status: s })); } catch { /* the next page asks again */ }
        })
        .catch(() => { /* no answer: the invitation */ })
        .then(() => clearTimeout(timer));
    };

    let secs = 0;
    try { secs = Number(sessionStorage.getItem(BETA_OFFER.seconds)) || 0; } catch { secs = 0; }
    let done = false;
    const clock = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      secs += 1;
      try { sessionStorage.setItem(BETA_OFFER.seconds, String(secs)); } catch { /* the count starts again on the next page */ }
      if (secs >= 5) askCount();
      if (secs >= BETA_OFFER.after) offer('minute');
    }, 1000);
    const leaving = (e) => { if (e.clientY <= 0 && secs >= BETA_OFFER.armExit) offer('leaving'); };
    document.documentElement.addEventListener('mouseleave', leaving);
    const offer = (how) => {
      if (done || betaPop) return;
      if (document.body.classList.contains('lightbox-open')) return;                  // another dialog has the screen
      const t = document.activeElement && document.activeElement.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;                 // someone is typing
      done = true;
      clearInterval(clock);
      document.documentElement.removeEventListener('mouseleave', leaving);
      const words = betaOfferWords(status);
      if (!words) return;                                                              // the beta is over or every key is taken
      if (!forced) {
        try { localStorage.setItem(BETA_OFFER.memory, JSON.stringify({ at: Date.now(), how })); } catch { /* shown again next visit */ }
        try { sessionStorage.setItem(BETA_OFFER.memory, 'shown'); } catch { /* the 14 days still hold */ }
      }
      showBetaOffer(how, words);
    };
    if (forced) { askCount(); setTimeout(() => offer('forced'), 1200); }
  };
  betaOfferStart();

  // Buttons that point at the store or the download come from config.
  // Guides (site/guides/): a product link carries data-amazon. With an Amazon Associates tag in
  // config.js the link becomes an affiliate link and the page's disclosure sentences show; with no
  // tag the links are plain Amazon links and nothing on the page claims a commission.
  if (cfg.amazonTag) {
    document.querySelectorAll('a[data-amazon]').forEach((a) => {
      try {
        const u = new URL(a.href);
        if (/(^|\.)amazon\.com$/.test(u.hostname)) { u.searchParams.set('tag', cfg.amazonTag); a.href = u.toString(); }
      } catch { /* leave the link as written */ }
    });
    document.querySelectorAll('[data-affiliate-disclosure]').forEach((el) => { el.hidden = false; });
  }
  // The download page (owner, 2026-10-23: "I would much rather it take you to a download page that had all
  // the proper download page information"). Every Download for Windows button opens it
  // ([data-download-page], plain links that nothing here rewrites); its own big button
  // ([data-installer-direct]) is the only one that downloads the installer itself.
  // Phones (owner, 2026-10-13: "Yeah, go ahead and do it"): most ad visitors arrive on a phone, where a
  // Windows installer is no use. On a phone the page's button becomes "Email me the download link",
  // which sends the page's address to the visitor's Windows computer (the page, not the file: on the
  // computer they see what they are installing first). A Mac or a Linux computer gets the two buttons
  // below instead; any other page keeps the button and the not-on-Windows box.
  const DOWNLOAD_PAGE = 'https://stellaurator.com/download.html';
  const mailLink = (href) => `mailto:?subject=${encodeURIComponent('StellAurator download')}&body=${encodeURIComponent(`Download StellAurator on my Windows computer: ${href}\n\nOr open https://stellaurator.com on that computer and press Download for Windows.`)}`;
  const isPhone = () => {
    try {
      const n = window.navigator || {};
      const ua = `${(n.userAgentData && n.userAgentData.platform) || n.platform || ''} ${n.userAgent || ''}`;
      if (/Windows/i.test(ua)) return false;
      if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
      return /Mac/i.test(ua) && (n.maxTouchPoints || 0) > 1;   // an iPad asking for the desktop site
    } catch { return false; }
  };
  const phone = isPhone();
  if (phone) {
    document.querySelectorAll('[data-installer-direct]').forEach((a) => {
      a.removeAttribute('data-installer-direct');
      a.setAttribute('data-email-link', '');
      a.href = mailLink(DOWNLOAD_PAGE);
      a.textContent = 'Email me the download link';
    });
    document.querySelectorAll('[data-installer-meta]').forEach((el) => { el.textContent = 'StellAurator installs on a Windows 10 or 11 computer.'; });
  }
  // A Mac or a Linux computer (docs/HOME_PAGE_CUT_BUILD.md part B, 2026-10-24) cannot install today, so it is
  // not asked to. On the home page and on the download page the Download button becomes two: "Watch the demo"
  // (the page's own intro film, assets/intro.mp4, opened in place under the buttons) and "Tell me when the Mac
  // version is ready" (coming.html, which has the waitlist), with one sentence under them. A Mac is a Macintosh
  // user agent without a touch screen (an iPad asking for the desktop site is a phone, above); Linux gets the
  // same two buttons and the shorter sentence. Every other page is unchanged.
  const desktopOs = () => {
    try {
      if (phone) return '';
      const n = window.navigator || {};
      const ua = `${(n.userAgentData && n.userAgentData.platform) || n.platform || ''} ${n.userAgent || ''}`;
      if (/Windows/i.test(ua)) return '';
      if (/Macintosh/i.test(ua) && (n.maxTouchPoints || 0) <= 1) return 'mac';
      if (/Linux|X11|CrOS/i.test(ua) && !/Android/i.test(ua)) return 'linux';
      return '';
    } catch { return ''; }
  };
  const cannotInstall = ['home', 'download'].includes(page) ? desktopOs() : '';
  if (cannotInstall) {
    const NOT_WINDOWS = { mac: 'StellAurator runs on Windows today; a Mac version is coming.', linux: 'StellAurator runs on Windows today.' };
    const buttons = page === 'home'
      ? [...document.querySelectorAll('[data-home-download] > a.btn-gold[data-download-page]')]
      : [...document.querySelectorAll('[data-installer-direct]')];
    let film = null;
    const watch = (row) => {
      if (!film) {
        film = document.createElement('video');
        film.className = 'hero-video brand-film';
        film.setAttribute('controls', '');
        film.setAttribute('playsinline', '');
        film.setAttribute('preload', 'metadata');
        film.setAttribute('poster', 'assets/intro-poster.jpg');
        film.setAttribute('aria-label', 'StellAurator demo');
        film.style.marginTop = '18px';
        film.src = 'assets/intro.mp4';
        row.insertAdjacentElement('afterend', film);
      }
      try { film.scrollIntoView({ block: 'nearest' }); } catch { /* a courtesy */ }
      const p = film.play && film.play();
      if (p && p.catch) p.catch(() => {});
    };
    buttons.forEach((a) => {
      const row = a.parentElement;
      const demo = document.createElement('a');
      demo.className = 'btn btn-gold';
      demo.href = '#';
      demo.setAttribute('data-watch-demo', '');
      demo.textContent = 'Watch the demo';
      demo.addEventListener('click', (e) => { e.preventDefault(); watch(row); });
      const tell = document.createElement('a');
      tell.className = 'btn btn-line';
      tell.href = '/coming.html';
      tell.setAttribute('data-mac-waitlist', '');
      tell.textContent = 'Tell me when the Mac version is ready';
      a.replaceWith(demo, tell);
      const note = document.createElement('p');
      note.className = 'cta-note';
      note.setAttribute('data-not-windows', cannotInstall);
      note.textContent = NOT_WINDOWS[cannotInstall];
      row.insertAdjacentElement('afterend', note);
    });
  }
  document.querySelectorAll('[data-subscribe]').forEach((a) => {
    const plan = a.getAttribute('data-subscribe') || '';
    if (cfg.accountSite) a.href = withRef(`${cfg.accountSite}/purchase${plan ? `?plan=${plan}` : ''}`);
    else if (cfg.subscribeUrl) a.href = cfg.subscribeUrl;
    else a.setAttribute('data-unconfigured', '1');
  });
  document.querySelectorAll('[data-download]').forEach((a) => {
    if (cfg.accountSite) a.href = withRef(`${cfg.accountSite}/downloads`);
    else if (cfg.downloadUrl) a.href = cfg.downloadUrl;
    else a.setAttribute('data-unconfigured', '1');
  });
  // The Meta pixel's events (pixel.js): a press on the trial button or a plan button sends Lead. The
  // trial itself starts with the installer, so StartTrial is sent by the download screen when its
  // installer button is pressed (embed/downloads.html, 2026-10-12). Nothing is sent when the pixel did
  // not load (a browser that asked not to be tracked, or a page without it).
  const pixel = (name, data) => { try { if (typeof window.fbq === 'function') window.fbq('track', name, data || {}); } catch { /* measurement never blocks a click */ } };
  document.querySelectorAll('[data-download]').forEach((a) => a.addEventListener('click', () => { pixel('Lead', { content_name: 'trial' }); }));
  document.querySelectorAll('[data-subscribe]').forEach((a) => a.addEventListener('click', () => pixel('Lead', { content_name: `plan-${a.getAttribute('data-subscribe') || 'any'}` })));
  // Phone interest counts too (2026-10-13): emailing or copying the download link is a lead (privacy
  // policy 2.3, section 4).
  document.querySelectorAll('[data-email-link]').forEach((a) => a.addEventListener('click', () => pixel('Lead', { content_name: 'email-link' })));

  // StellAurator runs on Windows. A phone, a Mac or a Linux computer that presses the trial button is
  // told so first, and offered the link for its Windows computer, rather than being sent to make an
  // account it cannot use there (outside audit, 2026-10-12: most ad visitors arrive on phones).
  const notWindows = () => {
    try {
      const n = window.navigator || {};
      const p = String((n.userAgentData && n.userAgentData.platform) || n.platform || '');
      const ua = String(n.userAgent || '');
      if (/Windows/i.test(p) || /Windows NT/i.test(ua)) return false;
      return /Android|iPhone|iPad|iPod|Mac|Linux|CrOS/i.test(`${p} ${ua}`);
    } catch { return false; }
  };
  // The Mac and phone waitlist (owner, 2026-10-13: "let people ask to be notified"). Any element with
  // [data-waitlist] becomes the form; its value ("mac", "iphone" or "android") ticks one box first, and an
  // empty value ticks the box for the device the visitor is on (Mac on a Mac). It POSTs to the back
  // office's /_functions/waitlist (site/wix/http-functions.js post_waitlist), which answers with the
  // thank-you line. The address is used only for the email that says the version is ready.
  const deviceGuess = () => {
    try {
      const n = window.navigator || {};
      const ua = `${(n.userAgentData && n.userAgentData.platform) || n.platform || ''} ${n.userAgent || ''}`;
      if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
      if (/Android/i.test(ua)) return 'android';
      return 'mac';
    } catch { return 'mac'; }
  };
  const waitlistEndpoint = () => cfg.waitlistEndpoint || (cfg.accountSite ? `${cfg.accountSite}/_functions/waitlist` : '');
  let waitlistCount = 0;
  const waitlistForm = (want) => {
    waitlistCount += 1;
    const id = `wl${waitlistCount}`;
    const first = ['mac', 'iphone', 'android'].includes(want) ? want : deviceGuess();
    const form = document.createElement('form');
    form.className = 'waitlist';
    form.noValidate = true;
    form.innerHTML = `<fieldset class="waitlist-picks"><legend>Which version do you want?</legend>${[['mac', 'Mac'], ['iphone', 'iPhone'], ['android', 'Android']]
      .map(([v, label]) => `<label><input type="checkbox" name="platform" value="${v}"${v === first ? ' checked' : ''}> ${label}</label>`).join('')}</fieldset>`
      + `<div class="waitlist-row"><label class="sr-only" for="${id}">Your email address</label><input id="${id}" type="email" name="email" autocomplete="email" placeholder="you@example.com" required>`
      + '<button class="btn btn-gold" type="submit" data-waitlist-submit>Tell me when it is ready</button></div>'
      + '<p class="fineprint waitlist-status" data-waitlist-status aria-live="polite">We email you once, when it is ready. Nothing else.</p>';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-waitlist-status]');
      const button = form.querySelector('button');
      const email = form.querySelector('input[type="email"]').value.trim();
      const platforms = [...form.querySelectorAll('input[name="platform"]:checked')].map((x) => x.value);
      const say = (text, tone) => { status.textContent = text; status.dataset.tone = tone || ''; };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Type your email address, then press Tell me when it is ready.', 'error'); return; }
      if (!platforms.length) { say('Tick Mac, iPhone or Android, then press Tell me when it is ready.', 'error'); return; }
      const url = waitlistEndpoint();
      if (!url) { say('Write to narrator@stellaurator.com and we will add you to the list.', 'error'); return; }
      button.disabled = true;
      say('Sending...');
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, platforms, page: location.pathname }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) { say(j.said || 'Thank you. We will email you once, when it is ready.', 'ok'); form.querySelector('input[type="email"]').value = ''; }
        else say(j.error || 'The sign-up did not go through. Try again in a minute, or write to narrator@stellaurator.com.', 'error');
      } catch {
        say('The sign-up did not go through. Try again in a minute, or write to narrator@stellaurator.com.', 'error');
      } finally { button.disabled = false; }
    });
    return form;
  };
  document.querySelectorAll('[data-waitlist]').forEach((el) => el.replaceWith(waitlistForm(el.getAttribute('data-waitlist') || '')));

  let osNote = null;
  const showOsNote = (href) => {
    if (!osNote) {
      osNote = document.createElement('div');
      osNote.className = 'os-note';
      osNote.hidden = true;
      osNote.setAttribute('role', 'dialog');
      osNote.setAttribute('aria-modal', 'true');
      osNote.setAttribute('aria-labelledby', 'os-note-title');
      osNote.innerHTML = '<div class="frame panel os-note-box">'
        + '<h2 class="title" id="os-note-title">StellAurator runs on Windows computers.</h2>'
        + '<p>It needs Windows 10 or 11, 64-bit. Open this link on your Windows computer to download it.</p>'
        + '<div class="cta-row os-note-actions">'
        + '<a class="btn btn-gold" data-os-mail href="#">Email me the link</a>'
        + '<button class="btn btn-line" type="button" data-os-copy>Copy the link</button>'
        + '</div>'
        + '<p class="fineprint os-note-status" data-os-status aria-live="polite"></p>'
        + '<h3 class="os-note-soon">A Mac version and phone apps are on the way.</h3>'
        + '<div data-os-waitlist></div>'
        + '<p class="fineprint"><a href="#" data-os-go>Continue anyway</a> &middot; <a href="#" data-os-close>Close</a></p>'
        + '</div>';
      document.body.appendChild(osNote);
      osNote.querySelector('[data-os-waitlist]').replaceWith(waitlistForm(''));
      const close = () => { osNote.hidden = true; document.body.classList.remove('lightbox-open'); };
      osNote.addEventListener('click', (e) => { if (e.target === osNote) close(); });
      osNote.querySelector('[data-os-close]').addEventListener('click', (e) => { e.preventDefault(); close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && osNote && !osNote.hidden) close(); });
      osNote.querySelector('[data-os-mail]').addEventListener('click', () => pixel('Lead', { content_name: 'email-link' }));
      osNote.querySelector('[data-os-copy]').addEventListener('click', async () => {
        pixel('Lead', { content_name: 'copy-link' });
        const status = osNote.querySelector('[data-os-status]');
        try { await navigator.clipboard.writeText(osNote.dataset.href); status.textContent = 'Copied. Paste it into an email or a message to yourself.'; }
        catch { status.textContent = osNote.dataset.href; }
      });
    }
    osNote.dataset.href = href;
    osNote.querySelector('[data-os-mail]').href = mailLink(href);
    osNote.querySelector('[data-os-go]').href = href;
    osNote.querySelector('[data-os-status]').textContent = '';
    osNote.hidden = false;
    document.body.classList.add('lightbox-open');
    try { osNote.querySelector('[data-os-mail]').focus(); } catch { /* focus is a courtesy */ }
  };
  document.querySelectorAll('[data-download]').forEach((a) => a.addEventListener('click', (e) => {
    // a phone goes straight on to make its account (2026-10-13); a Mac or Linux computer is told first
    if (!notWindows() || phone || !a.href || a.getAttribute('href') === '#') return;
    e.preventDefault();
    showOsNote(a.href);
  }));

  // The latest release, read once from the public releases page's data at GitHub and kept for an hour:
  // the footer's version line and the download page's button both use it.
  let releaseAsk = null;
  const latestRelease = () => {
    if (releaseAsk) return releaseAsk;
    let cached = null;
    try { cached = JSON.parse(window.sessionStorage.getItem('stella.release') || 'null'); } catch { cached = null; }
    if (cached && cached.exe && Date.now() - cached.read < 3600000) { releaseAsk = Promise.resolve(cached); return releaseAsk; }
    releaseAsk = fetch('https://api.github.com/repos/jathtech/stellaurator-releases/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.tag_name || !/^https:\/\/github\.com\//.test(String(j.html_url || ''))) return null;
        const exe = (j.assets || []).find((x) => /^StellAurator-Setup-[\d.]+\.exe$/.test(String(x.name || ''))
          && /^https:\/\/github\.com\/jathtech\/stellaurator-releases\/releases\/download\//.test(String(x.browser_download_url || '')));
        const rel = { tag: String(j.tag_name), at: String(j.published_at || ''), url: String(j.html_url), exe: exe ? String(exe.browser_download_url) : '', size: exe ? Number(exe.size) || 0 : 0, read: Date.now() };
        try { window.sessionStorage.setItem('stella.release', JSON.stringify(rel)); } catch { /* the cache is a courtesy */ }
        return rel;
      })
      .catch(() => null);
    return releaseAsk;
  };

  // The current version, its date and its notes, in the footer of every page, left out when it cannot
  // be read.
  const footSpan = document.querySelector('footer .wrap > span');
  if (footSpan) {
    // every page says the Mac and phone versions are coming, and where to sign up (owner, 2026-10-13)
    const soon = document.createElement('span');
    soon.className = 'release-line';
    soon.innerHTML = 'StellAurator for Mac and phones is on the way. <a href="/coming.html">Get notified</a>';
    footSpan.append(document.createElement('br'), soon);
    latestRelease().then((rel) => {
      if (!rel || !rel.tag) return;
      const when = new Date(rel.at);
      const date = Number.isFinite(when.getTime()) ? when.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const line = document.createElement('span');
      line.className = 'release-line';
      line.append(`Version ${rel.tag.replace(/^v/i, '')}${date ? `, released ${date}` : ''}. `);
      const link = document.createElement('a');
      // that version's notes on the download page (2026-10-23), not its GitHub page, which lists files
      link.href = `/download.html#v${rel.tag.replace(/^v/i, '').replace(/\./g, '-')}`;
      link.textContent = 'What’s new';
      line.append(link);
      footSpan.append(document.createElement('br'), line);
    }).catch(() => { /* no line rather than a wrong one */ });
  }

  // The download page's big button (site/download.html, owner 2026-10-23): [data-installer-direct] is the
  // Windows installer itself, no account first (the account is made in the app), and the only such button
  // on the site. The page is written from the release list when the site is published, and data-version
  // is the version it was written with; when a newer version has come out since, the button and the
  // version line above it ([data-release-line]) take the newer installer, its version, date and size.
  const directs = [...document.querySelectorAll('[data-installer-direct]')];
  if (directs.length) {
    directs.forEach((a) => a.addEventListener('click', (e) => {
      // A lead, as the privacy policy says of the website's buttons; StartTrial stays the download
      // screen's (embed/downloads.html), where the policy names it.
      pixel('Lead', { content_name: 'installer' });
      if (!notWindows()) return;
      e.preventDefault();
      showOsNote(a.href);
    }));
    const newer = (x, y) => { const p = x.split('.').map(Number); const q = y.split('.').map(Number); for (let i = 0; i < 3; i++) if (p[i] !== q[i]) return p[i] > q[i]; return false; };
    latestRelease().then((rel) => {
      if (!rel || !rel.exe) return;
      const v = rel.tag.replace(/^v/i, '');
      const when = new Date(rel.at);
      const date = Number.isFinite(when.getTime()) ? when.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      directs.forEach((a) => {
        if (!/^\d+\.\d+\.\d+$/.test(v) || !newer(v, a.dataset.version || '0.0.0')) return;
        a.href = rel.exe;
        a.dataset.version = v;
        a.textContent = `Download StellAurator ${v} for Windows`;
        document.querySelectorAll('[data-release-line]').forEach((el) => { el.textContent = `Version ${v}${date ? `, released ${date}` : ''}.`; });
      });
    }).catch(() => { /* the page's own installer stays */ });
  }

  // Screenshots enlarge on click. Any image inside a figure.frame opens in a lightbox; click, Esc
  // or the close button puts it away and focus goes back where it was.
  const shots = [...document.querySelectorAll('figure.frame img')];
  if (shots.length) {
    let box = null;
    let opener = null;
    const close = () => {
      if (!box) return;
      box.hidden = true;
      box.classList.remove('zoomed');
      document.body.classList.remove('lightbox-open');
      if (opener) { try { opener.focus(); } catch (e) {} }
      opener = null;
    };
    const ensure = () => {
      if (box) return box;
      box = document.createElement('div');
      box.className = 'lightbox';
      box.hidden = true;
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Enlarged screenshot');
      box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">&#x2715;</button><figure><img alt=""><figcaption></figcaption></figure>';
      // a click beside the picture closes; a click ON it toggles 1:1 (the enlarged file is the 2x
      // capture, so 1:1 shows every pixel the studio drew; the figure scrolls while zoomed)
      box.addEventListener('click', (e) => { if (!e.target.closest('img')) close(); else box.classList.toggle('zoomed'); });
      document.body.appendChild(box);
      return box;
    };
    const open = (img) => {
      const b = ensure();
      const big = b.querySelector('img');
      // the enlarged picture is the 2x file when the page has one (data-full), else what is shown
      b.classList.remove('zoomed');
      big.src = img.getAttribute('data-full') || img.currentSrc || img.src;
      big.alt = img.alt || '';
      const cap = img.closest('figure') && img.closest('figure').querySelector('figcaption');
      b.querySelector('figcaption').textContent = cap ? cap.textContent : '';
      opener = img;
      b.hidden = false;
      document.body.classList.add('lightbox-open');
      b.querySelector('.lightbox-close').focus();
    };
    shots.forEach((img) => {
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt ? img.alt + ' ' : '') + '(click to enlarge; click the enlarged picture for full size)');
      img.addEventListener('click', () => open(img));
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); } });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // Recommended reading (owner, 2026-10-24: "add a little 'recommended reading' to each page, like a small ad for
  // one of the guides. It would appear off to the right near the top. It would randomly choose a guide to show.").
  // One list, here and nowhere else; one pick per page load, never the page the reader is on, nothing stored. The
  // aside sits to the right of the page's head at 1080 px and up (theme.css .section-head.has-reading) and under
  // it below that; on the home page, whose hero is centered, it is a strip under the hero. Not on the functional
  // pages: the license agreement, the account page, an invitation and the beta page.
  // The owner, 2026-10-25: "recommended reading should include a picture from that guide", and "I'd rather not even
  // have the phrase 'recommended reading'. Just have the title as the headline." So each reading is a guide with a
  // picture the guide itself shows (its first pick, or its app screenshot): the picture, the title as the headline,
  // the one line. `photo` marks a product photo on white, shown as a tile; a screenshot fills the frame, enlarged
  // around `focus` (the part worth seeing at 300 px: the prompter's lit line, the Finish screen's numbers). The compare
  // page and the glossary, which are not guides and carry no picture, are no longer in the list.
  const READINGS = [
    { href: 'guides/make-an-audiobook.html', title: 'Making an audiobook of your book', line: 'The whole job in order, from the manuscript to the day it goes on sale.', img: 'assets/shot-prompter.jpg', focus: '45% 44%' },
    { href: 'guides/microphones.html', title: 'Choosing a microphone', line: 'A pick in every price tier, for hours of one voice in a home room.', img: 'assets/guides/samson-q2u.jpg', photo: true },
    { href: 'guides/audio-interfaces.html', title: 'Choosing an audio interface', line: 'What the box between an XLR microphone and the computer does, and which to buy.', img: 'assets/guides/focusrite-scarlett-solo.jpg', photo: true },
    { href: 'guides/headphones.html', title: 'Choosing headphones', line: 'Closed-back pairs for recording and editing, in every price tier.', img: 'assets/guides/at-ath-m20x.jpg', photo: true },
    { href: 'guides/room-treatment.html', title: 'Treating the room', line: 'What a bare room does to a recording, and what fixes it at each budget.', img: 'assets/guides/se-reflexion-filter-x.jpg', photo: true },
    { href: 'guides/acx-requirements.html', title: 'What ACX requires', line: 'Each of Audible’s audio requirements, what it measures and how to meet it.', img: 'assets/shot-finish.jpg', focus: '62% 30%' },
  ];
  const READING_SKIP = ['terms', 'account', 'invite', 'beta'];
  const readingPick = () => {
    const path = String(window.location.pathname || '').replace(/index\.html$/, '');
    const pool = READINGS.filter((r) => !path.endsWith('/' + r.href) && !path.endsWith('/' + r.href.replace(/index\.html$/, '')));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };
  const mountReading = () => {
    if (READING_SKIP.includes(page)) return;
    const main = document.querySelector('main');
    const first = main && main.querySelector(':scope > section');
    if (!first) return;
    const pick = readingPick();
    if (!pick) return;
    const aside = document.createElement('aside');
    aside.className = 'reading';
    aside.setAttribute('data-reading', pick.href);
    // the picture is a second way to the same guide, kept out of the tab order and away from screen readers so the
    // title is the one link they meet; the 2x file sits beside the 1x one, as on the guides
    const img = `/${esc(pick.img)}`;
    const img2 = `/${esc(pick.img.replace(/\.jpg$/, '@2x.jpg'))}`;
    const focus = pick.focus ? ` style="--focus: ${esc(pick.focus)}"` : '';
    aside.innerHTML = `<a class="reading-pic${pick.photo ? ' is-photo' : ''}"${focus} href="/${esc(pick.href)}" tabindex="-1" aria-hidden="true"><img src="${img}" srcset="${img} 1x, ${img2} 2x" alt="" decoding="async"></a>`
      + `<div class="reading-text"><a class="reading-title" href="/${esc(pick.href)}">${esc(pick.title)}</a><p class="reading-line">${esc(pick.line)}</p></div>`;
    const head = first.classList.contains('page-head') ? first.querySelector(':scope > .section-head') : null;
    if (head) {
      // the head's own text becomes the first column of a two-column grid at 1080 px and up; the aside is the second
      const text = document.createElement('div');
      text.className = 'section-head-text';
      while (head.firstChild) text.appendChild(head.firstChild);
      head.append(text, aside);
      head.classList.add('has-reading');
    } else {
      aside.classList.add('reading-strip', 'wrap');
      first.insertAdjacentElement('afterend', aside);
    }
  };
  mountReading();

  window.STELLA = {
    cfg,
    esc,
    readAccount,
    saveAccount(a) { localStorage.setItem('stella.account', JSON.stringify(a)); },
    clearAccount() { localStorage.removeItem('stella.account'); },
  };
})();
