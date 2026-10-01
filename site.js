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

  // A conventional bar: what it is, how it works, what it costs, questions - then Sign in and the
  // one action that matters, the free trial. Terms, privacy and contact live in the footer.
  const home = page === 'home' ? '' : './';
  const links = [
    [`${home}#features`, 'Features', ''],
    [`${home}#how`, 'How it works', ''],
    [`${home}#voices`, 'Voices', ''],
    ['pricing.html', 'Pricing', 'pricing'],
    // The public alpha (site/alpha/index.html, served at stellaurator.com/alpha/).
    ['alpha/', 'Alpha', 'alpha'],
    [`${home}#faq`, 'FAQ', ''],
  ];
  const mount = document.querySelector('[data-nav]');
  if (mount) {
    const header = document.createElement('header');
    header.className = 'nav';
    header.innerHTML = `<div class="wrap">
      <a class="brand" href="./" aria-label="StellAurator home"><img class="mark" src="assets/logo.png" alt=""><img class="word" src="assets/wordmark.png" alt="StellAurator"></a>
      <nav aria-label="Pages">${links.map(([href, label, id]) => `<a href="${href}"${id && id === page ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <a class="nav-signin" href="account.html"${page === 'account' ? ' aria-current="page"' : ''}>${account ? esc(account.name || 'Account') : 'Sign in'}</a>
      <a class="btn btn-gold nav-account" href="#" data-download>Try free</a>
    </div>`;
    mount.replaceWith(header);
  }

  // Buttons that point at the store or the download come from config.
  document.querySelectorAll('[data-subscribe]').forEach((a) => {
    const plan = a.getAttribute('data-subscribe') || '';
    if (cfg.accountSite) a.href = `${cfg.accountSite}/purchase${plan ? `?plan=${plan}` : ''}`;
    else if (cfg.subscribeUrl) a.href = cfg.subscribeUrl;
    else a.setAttribute('data-unconfigured', '1');
  });
  document.querySelectorAll('[data-download]').forEach((a) => {
    if (cfg.accountSite) a.href = `${cfg.accountSite}/downloads`;
    else if (cfg.downloadUrl) a.href = cfg.downloadUrl;
    else a.setAttribute('data-unconfigured', '1');
  });

  // Screenshots enlarge on click. Any image inside a figure.frame opens in a lightbox; click, Esc
  // or the close button puts it away and focus goes back where it was.
  const shots = [...document.querySelectorAll('figure.frame img')];
  if (shots.length) {
    let box = null;
    let opener = null;
    const close = () => {
      if (!box) return;
      box.hidden = true;
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
      box.addEventListener('click', (e) => { if (!e.target.closest('img')) close(); });
      document.body.appendChild(box);
      return box;
    };
    const open = (img) => {
      const b = ensure();
      const big = b.querySelector('img');
      big.src = img.currentSrc || img.src;
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
      img.setAttribute('aria-label', (img.alt ? img.alt + ' ' : '') + '(click to enlarge)');
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
