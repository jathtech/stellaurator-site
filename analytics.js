// The website's analytics (owner 2026-10-12: "We need to add a full analytics suite to the website"):
// Google Analytics 4 for visitors, sources, pages and the funnel, and Microsoft Clarity for
// recordings of how the pages are used, beside the Meta pixel (pixel.js). Loaded only on the public
// pages of stellaurator.com and, events only, on the download screen inside the account site
// (embed/downloads.html, marked data-mode="events"). The StellAurator program loads none of this.
//
// Nothing loads when config.js says this browser is not to be measured (STELLA_TRACK_OK: Global
// Privacy Control, Do Not Track, a page off stellaurator.com, or the owner's own browser after
// ?owner=1). An empty ga4Id loads no Google Analytics; an empty clarityId loads no Clarity; an empty
// adsId loads no Google Ads conversion tag (owner 2026-10-18: the search ads count a press of the free
// trial button and of an installer download button, nothing else). The
// events and where to read them: docs/ANALYTICS.md. What this sends: terms.html#privacy, sections 3
// and 4.
(() => {
  const script = document.currentScript;
  const eventsOnly = !!(script && script.getAttribute('data-mode') === 'events');
  const n = window.navigator || {};
  if (n.globalPrivacyControl === true || n.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (window.STELLA_TRACK_OK !== true) return;
  const cfg = window.STELLA_CONFIG || {};
  const ga4Id = String(cfg.ga4Id || '').trim();
  const clarityId = String(cfg.clarityId || '').trim();

  // The hour on the visitor's own clock (docs/VISIT_HOURS_BUILD.md; privacy policy, "The hour on your
  // own clock"). One count per page view and one per counted press, sent to the back office's
  // /_functions/hourCount: exactly { e, k, h, d, dev, ad, p }. h and d are the hour and weekday on this
  // device's clock; dev is phone, tablet or computer; ad is 1 when this visit came from a Facebook ad;
  // p is the page id. No address, URL, identifier, time zone name or referrer is ever sent. It runs
  // behind the same gate as the rest of this file, and a failed send is silent.
  (() => {
    try {
      const url = String(cfg.hoursEndpoint || (cfg.accountSite ? `${cfg.accountSite}/_functions/hourCount` : ''));
      if (!url || typeof n.sendBeacon !== 'function') return;
      const ua = String(n.userAgent || '');
      const dev = (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/i.test(ua) && (n.maxTouchPoints || 0) > 1))
        ? 'tablet'   // an iPad asking for the desktop site says Macintosh and has a touch screen
        : (/iPhone|iPod|Android|Mobi|Windows Phone/i.test(ua) ? 'phone' : 'computer');
      let ad = 0;
      try {
        const q = new URLSearchParams((window.location && window.location.search) || '');
        if (String(q.get('utm_source') || '').toLowerCase() === 'facebook' || q.has('fbclid')) {
          ad = 1;
          window.sessionStorage.setItem('stella.fbad', '1');
        } else if (window.sessionStorage.getItem('stella.fbad') === '1') ad = 1;
      } catch { /* storage blocked: this page alone decides */ }
      // The back office refuses a count whose page it does not list (site/wix/hourCountLogic.js PAGES, which
      // this list repeats), and keeps no page anyway: any other page, the download page among them, is 'other'.
      const KNOWN = ['home', 'pricing', 'alpha', 'contact', 'terms', 'guides', 'studio', 'narrators', 'voices', 'themes', 'books', 'coming', 'downloads', 'other'];
      const pageId = () => {
        const p = (document.body && document.body.dataset && document.body.dataset.page) || (eventsOnly ? 'downloads' : 'other');
        return KNOWN.includes(p) ? p : 'other';
      };
      const count = (e, k) => {
        try {
          const at = new Date();
          n.sendBeacon(url, JSON.stringify({ e, k, h: at.getHours(), d: at.getDay(), dev, ad, p: pageId() }));
        } catch { /* measurement never blocks a click */ }
      };
      if (document.body) count('visit', '');
      else document.addEventListener('DOMContentLoaded', () => count('visit', ''), { once: true });
      document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest ? e.target : null;
        if (!t) return;
        let k = '';
        // 'download' is the download page's installer button. A button that only opens the download page
        // ([data-download-page]) is not a kind the back office counts; the page's own visit is.
        if (eventsOnly) { if (t.closest('[data-installer]')) k = 'installer'; }
        else if (t.closest('[data-installer-direct]')) k = 'download';
        else if (t.closest('[data-email-link], [data-os-mail]')) k = 'email-link';
        else if (t.closest('[data-os-copy]')) k = 'copy-link';
        else if (t.closest('[data-download]')) k = 'trial';
        else if (t.closest('[data-subscribe]')) k = 'plan';
        if (k) count('press', k);
      }, true);
      if (!eventsOnly) {
        document.addEventListener('submit', (e) => {
          const f = e.target;
          if (f && f.closest && f.closest('form.waitlist')) count('press', 'waitlist');
        }, true);
      }
    } catch { /* measurement never blocks the page */ }
  })();

  // Google Analytics 4: analytics only, no Google signals and no ad personalization. On the download
  // screen no page view is sent: the account site's own Google Analytics counts that page.
  if (ga4Id) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(tag);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    const settings = { allow_google_signals: false, allow_ad_personalization_signals: false };
    if (eventsOnly) settings.send_page_view = false;
    window.gtag('config', ga4Id, settings);
  }

  // Microsoft Clarity: never on the download screen. The contact form carries data-clarity-mask.
  if (clarityId && !eventsOnly) {
    /* eslint-disable */
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", clarityId);
    /* eslint-enable */
  }

  // Google Ads: the conversion tag only. A press of the free trial button and a press of an installer
  // download button are reported as conversions, so the search ads can be judged by trials. Ad
  // personalization and Google signals are off: nothing here is used to follow anyone with ads.
  const adsId = String(cfg.adsId || '').trim();
  const conversions = cfg.adsConversions || {};
  if (adsId) {
    if (typeof window.gtag !== 'function') {
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
      document.head.appendChild(tag);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
    }
    window.gtag('config', adsId, { allow_google_signals: false, allow_ad_personalization_signals: false });
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      let sendTo = '';
      if (t.closest('[data-installer], [data-installer-direct]')) sendTo = conversions.installer;
      else if (!eventsOnly && t.closest('[data-download]')) sendTo = conversions.trial;
      if (!sendTo) return;
      try { window.gtag('event', 'conversion', { send_to: String(sendTo), transport_type: 'beacon' }); } catch { /* measurement never blocks a click */ }
    }, true);
  }

  if (!ga4Id) return;
  const send = (name, params) => { try { window.gtag('event', name, params || {}); } catch { /* measurement never blocks a click */ } };
  const page = () => (document.body && document.body.dataset.page) || window.location.pathname.replace(/^\/+|\.html$/g, '') || 'home';
  const words = (el) => String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const hostOf = (a) => { try { return new URL(a.href, window.location.href).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const pathOf = (a) => { try { const u = new URL(a.href, window.location.href); return u.hostname.replace(/^www\./, '') === 'stellaurator.com' ? u.pathname : ''; } catch { return ''; } };

  if (eventsOnly) {
    // The download screen: the last step of the funnel. Its buttons are drawn after this runs, so
    // one listener on the document answers them all.
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      if (t.closest('[data-installer]')) send('download_installer', { page: 'downloads' });
      else if (t.closest('[data-signin-app]')) send('sign_in_app', { page: 'downloads' });
    }, true);
    return;
  }

  // One listener on the document, in the capture phase, so the header site.js builds later is
  // answered too, and nothing here can stop a click from doing its job.
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    // The open beta offer (site.js): the popup's own two buttons, told apart from the same link elsewhere.
    const offerBox = t.closest('.beta-pop');
    if (offerBox) {
      if (t.closest('[data-beta-go]')) send('beta_offer_go', { page: page(), how: offerBox.getAttribute('data-how') || '' });
      else if (t.closest('[data-beta-close]')) send('beta_offer_close', { page: page(), how: offerBox.getAttribute('data-how') || '' });
      return;
    }
    if (t.closest('[data-installer-direct]')) { send('download_installer', { page: page() }); return; }
    if (t.closest('[data-download-page]')) { send('download_page', { page: page() }); return; }
    if (t.closest('[data-email-link], [data-os-mail]')) { send('email_link', { page: page() }); return; }
    if (t.closest('[data-os-copy]')) { send('copy_link', { page: page() }); return; }
    if (t.closest('[data-download]')) { send('try_free', { page: page() }); return; }
    const plan = t.closest('[data-subscribe]');
    if (plan) { send('choose_plan', { plan: plan.getAttribute('data-subscribe') || 'any' }); return; }
    const menu = t.closest('.nav-menu');
    if (menu) { if (menu.getAttribute('aria-expanded') !== 'true') send('menu_open', { page: page() }); return; }
    const a = t.closest('a[href]');
    if (!a) return;
    if (hostOf(a) === 'try.elevenlabs.io') { send('elevenlabs_click', { page: page() }); return; }
    if (a.matches('a[data-amazon], .pick-links a')) {
      const card = a.closest('article, .pick');
      send('shop_click', {
        retailer: hostOf(a),
        product: words(card && card.querySelector('h3, h2')) || a.getAttribute('data-amazon') || '',
        guide: window.location.pathname.replace(/^\/guides\/|\.html$/g, '') || 'guides',
      });
      return;
    }
    if (/^\/alpha\/?$/.test(pathOf(a))) send('join_alpha', { page: page() });
    if (/^\/beta\/?$/.test(pathOf(a))) send('join_beta', { page: page(), from: a.getAttribute('data-from') || 'link' });
  }, true);

  // A question in the FAQ opened. The toggle event does not bubble, so it is caught on the way down.
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    send('faq_open', { question: words(d.querySelector('summary')) });
  }, true);

  // The contact form sent its message (contact.html dispatches this at its success line).
  window.addEventListener('stella:contact-sent', () => send('contact_sent', { page: 'contact' }));
})();
