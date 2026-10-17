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
  // help); the audience and detail pages sit under More. The alpha is not in the bar: it is reached
  // from the footer (Alpha program) and by its own address, stellaurator.com/alpha/.
  const links = [
    ['studio.html', 'The studio', 'studio'],
    // The eight recorded demos (site/demos.html).
    ['demos.html', 'Demos', 'demos'],
    ['pricing.html', 'Pricing', 'pricing'],
    ['guides/', 'Guides', 'guides'],
  ];
  const more = [
    ['narrators.html', 'For narrators', 'narrators'],
    ['voices.html', 'Voices', 'voices'],
    // Books made with StellAurator (site/books.html): authors' audiobooks, free to list, no commission.
    ['books.html', 'Books', 'books'],
    [`${home}#faq`, 'FAQ', ''],
  ];
  const link = ([href, label, id]) => `<a href="${href}"${id && id === page ? ' aria-current="page"' : ''}>${label}</a>`;
  const moreOpen = more.some(([, , id]) => id && id === page);
  const mount = document.querySelector('[data-nav]');
  if (mount) {
    const header = document.createElement('header');
    header.className = 'nav';
    header.innerHTML = `<div class="wrap">
      <a class="brand" href="./" aria-label="StellAurator home"><img class="mark" src="assets/logo.png" alt=""><img class="word" src="assets/wordmark.png" alt="StellAurator"></a>
      <button class="nav-menu" type="button" aria-expanded="false" aria-controls="nav-pages"><svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Menu</button>
      <nav id="nav-pages" aria-label="Pages">${links.map(link).join('')}<details class="nav-more"${moreOpen ? ' open' : ''}><summary>More</summary><div class="nav-more-list">${more.map(link).join('')}</div></details></nav>
      <a class="nav-signin" href="${cfg.accountSite ? `${cfg.accountSite}/account` : 'account.html'}"${page === 'account' ? ' aria-current="page"' : ''}>${account ? esc(account.name || 'Account') : 'Sign in'}</a>
      <a class="btn btn-gold nav-account" href="https://account.stellaurator.com/downloads" data-installer-direct>Download</a>
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
  // Phones (owner, 2026-10-13: "Yeah, go ahead and do it"). Most ad visitors arrive on a phone, where a
  // Windows installer is no use, and on October 13 none of them pressed "Download for Windows". On a
  // phone the download buttons become the free trial button, which makes the account now (the seven
  // days start the first time the app is signed in on the computer), and a row of buttons gains "Email
  // me the download link". A Mac or Linux computer keeps the download button and the not-on-Windows box.
  const RELEASES_PAGE = 'https://github.com/jathtech/stellaurator-releases/releases/latest';
  // Where a download button goes until the installer's own address is known, and in an email: the
  // download page, which lists the current installer without an account (the audit of 2026-10-16: a
  // visitor must never land on a release listing and pick a file).
  const DOWNLOADS_PAGE = cfg.accountSite ? `${cfg.accountSite}/downloads` : RELEASES_PAGE;
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
      a.setAttribute('data-download', '');
      a.textContent = a.classList.contains('nav-account') ? 'Free trial' : 'Start your free 7-day trial';
      if (!a.closest('.cta-row')) return;
      const mail = document.createElement('a');
      mail.className = 'btn btn-line';
      mail.href = mailLink(DOWNLOADS_PAGE);
      mail.setAttribute('data-email-link', '');
      mail.textContent = 'Email me the download link';
      a.after(mail);
    });
    document.querySelectorAll('[data-installer-meta]').forEach((el) => { el.textContent = 'StellAurator installs on a Windows 10 or 11 computer.'; });
    document.querySelectorAll('[data-account-note]').forEach((el) => { el.textContent = 'Make your account here now. The 7 days start the first time you sign in on your computer.'; });
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
        + '<p>It needs Windows 10 or 11, 64-bit. To download it, open this link on your Windows computer. You can send it to yourself now:</p>'
        + '<div class="cta-row os-note-actions">'
        + '<a class="btn btn-gold" data-os-mail href="#">Email me the link</a>'
        + '<button class="btn btn-line" type="button" data-os-copy>Copy the link</button>'
        + '</div>'
        + '<p class="fineprint os-note-status" data-os-status aria-live="polite"></p>'
        + '<h3 class="os-note-soon">A Mac version and phone apps are on the way.</h3>'
        + '<p>Leave your email and we will tell you when yours is ready.</p>'
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
  // the footer's version line and the direct download buttons both use it.
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
      link.href = rel.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'What’s new';
      line.append(link);
      footSpan.append(document.createElement('br'), line);
    }).catch(() => { /* no line rather than a wrong one */ });
  }

  // The direct download (owner, 2026-10-13: "a simple download button ... It actually downloads it"):
  // [data-installer-direct] is the Windows installer itself, no account first; the account is made in
  // the app. Until the release is read, and if it cannot be, the link opens the latest release's page,
  // which lists the same installer. [data-installer-meta] beside it says the version and the size.
  const directs = [...document.querySelectorAll('[data-installer-direct]')];
  if (directs.length) {
    directs.forEach((a) => {
      if (!a.getAttribute('href') || a.getAttribute('href') === '#' || /releases\/latest$/.test(a.getAttribute('href'))) a.href = DOWNLOADS_PAGE;
      a.addEventListener('click', (e) => {
        // A lead, as the privacy policy says of the website's buttons; StartTrial stays the download
        // screen's (embed/downloads.html), where the policy names it.
        pixel('Lead', { content_name: 'installer' });
        if (!notWindows()) return;
        e.preventDefault();
        showOsNote(a.href);
      });
    });
    latestRelease().then((rel) => {
      if (!rel || !rel.exe) return;
      const mb = rel.size ? Math.round(rel.size / 1048576) : 0;
      directs.forEach((a) => { a.href = rel.exe; });
      document.querySelectorAll('[data-installer-meta]').forEach((el) => {
        el.textContent = `Version ${rel.tag.replace(/^v/i, '')} for Windows 10 and 11, 64-bit${mb ? `, ${mb.toLocaleString('en-US')} MB` : ''}.`;
      });
    }).catch(() => { /* the release page link stays */ });
  }
  if (phone) {
    latestRelease().then((rel) => {
      if (rel && rel.exe) document.querySelectorAll('[data-email-link]').forEach((m) => { m.href = mailLink(rel.exe); });
    }).catch(() => { /* the release page link stays */ });
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

  window.STELLA = {
    cfg,
    esc,
    readAccount,
    saveAccount(a) { localStorage.setItem('stella.account', JSON.stringify(a)); },
    clearAccount() { localStorage.removeItem('stella.account'); },
  };
})();
