// The Meta pixel on stellaurator.com (owner 2026-10-10: "do the pixel"): one page view per page, and
// the events site.js sends when the trial or a plan button is pressed (Lead, and StartTrial for the
// trial), so the ads can be measured and optimized. Loaded only here, on the public pages of the
// website; the StellAurator program sends nothing to Meta. A browser that asks not to be tracked
// (Global Privacy Control or Do Not Track) loads nothing, and neither does a page off
// stellaurator.com or the owner's own browser (config.js, STELLA_TRACK_OK). What this sends is described in the
// privacy policy, terms.html#privacy, sections 3 and 4.
//
// data-mode="events" (owner 2026-10-12: "a download or even a purchase is the desired outcome"): the
// download and plans screens shown inside the account site load the pixel with no page view, and send
// only StartTrial when the installer button is pressed (embed/downloads.html) and CompleteRegistration
// when an alpha key is claimed (embed/purchase.html), so the ads can be measured on what matters.
(() => {
  const script = document.currentScript;
  const eventsOnly = !!(script && script.getAttribute('data-mode') === 'events');
  const n = window.navigator || {};
  if (n.globalPrivacyControl === true || n.doNotTrack === '1' || window.doNotTrack === '1') return;
  // config.js decides the rest: only on stellaurator.com, and never in the owner's own browser.
  if (window.STELLA_TRACK_OK !== true) return;
  const PIXEL_ID = '549162199199531';
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_ID);
  if (!eventsOnly) window.fbq('track', 'PageView');
})();
