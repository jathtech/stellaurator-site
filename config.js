// StellAurator website — launch configuration. Fill these in and redeploy.
// Nothing here is secret; every value is public on the page.
window.STELLA_CONFIG = {
  // The Wix site that holds accounts, purchases and downloads. Every account
  // action on these pages links there; the member session lives on that host.
  accountSite: 'https://account.stellaurator.com',
  // Left empty: the purchase page is accountSite + '/purchase?plan=...'.
  subscribeUrl: '',
  // The back office's contact function, asked directly (it answers this site's
  // origin with CORS). The site is plain static hosting - GitHub Pages - so there
  // is no /api proxy of its own any more (the old host's was metered, and its
  // allowance running out took the whole site down, 2026-09-18).
  contactEndpoint: 'https://account.stellaurator.com/_functions/contact',
  // Shown as a mailto link while contactEndpoint is empty.
  contactFallbackEmail: 'narrator@stellaurator.com',
  // The home page's ratings (reviews.js, site/wix/README.md section 18). Left empty it falls back to
  // accountSite + '/_functions/reviews'.
  reviewsEndpoint: '',
  // The invitation page (invite.html) asks the back office what an invitation code is for:
  // the display title, the performer's name, who is inviting and where it stands. Left empty
  // it falls back to accountSite + '/_functions/inviteInfo'. The pairing key is in the link's
  // fragment and is NEVER part of this request.
  inviteEndpoint: '',
  // The Mac and phone waitlist's form (site.js [data-waitlist]). Left empty it falls back to
  // accountSite + '/_functions/waitlist' (site/wix/http-functions.js post_waitlist).
  waitlistEndpoint: '',
  // When people visit and press, on their own clock (site/analytics.js, docs/VISIT_HOURS_BUILD.md). Left
  // empty it falls back to accountSite + '/_functions/hourCount' (site/wix/http-functions.js post_hourCount).
  hoursEndpoint: '',
  // Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application).
  // Add your site's origin to "Authorized JavaScript origins".
  googleClientId: '',
  // Amazon Associates tracking id (Associates Central, Manage Your Tracking IDs), for the product
  // links in the guides (site/guides/). Empty: plain Amazon links and no commission sentence.
  amazonTag: 'jathtech-20',
  // Installer download for signed-in subscribers.
  downloadUrl: '',
  // Google Analytics 4 Measurement ID (starts with G-): analytics.google.com, Admin, Data streams,
  // the stellaurator.com stream. Empty: Google Analytics is not loaded. See docs/ANALYTICS.md.
  ga4Id: '',
  // Microsoft Clarity project ID: clarity.microsoft.com, the StellAurator project, Settings, Setup.
  // Empty: Clarity is not loaded. See docs/ANALYTICS.md.
  clarityId: '',
  // Google Ads conversion tag (Google Ads, Goals, Conversions, the account 338-893-4396): the tag ID
  // (starts with AW-) and the send_to of each conversion action. A press of the free trial button is
  // "Trial button press"; a press of an installer download button is "Installer download". Empty adsId:
  // no Google Ads tag is loaded. See docs/ANALYTICS.md and the privacy policy, section 4, Google Ads.
  adsId: 'AW-17956575757',
  adsConversions: {
    trial: 'AW-17956575757/Leh0CMfipaEdEI20rvJC',
    installer: 'AW-17956575757/7-IPCMripaEdEI20rvJC',
  },
};

// May this browser be measured? One answer, read by pixel.js and analytics.js alike. No when the
// browser sends Global Privacy Control or Do Not Track, when the page is not served from
// stellaurator.com (a file on disk, localhost, a preview host), or when this browser belongs to the
// owner: visiting any page with ?owner=1 remembers that here, and ?owner=0 forgets it.
window.STELLA_TRACK_OK = (() => {
  try {
    const owner = new URLSearchParams(window.location.search).get('owner');
    try {
      if (owner === '1') window.localStorage.setItem('stella.owner', '1');
      else if (owner === '0') window.localStorage.removeItem('stella.owner');
    } catch { /* storage blocked: the flag cannot be kept */ }
    const n = window.navigator || {};
    if (n.globalPrivacyControl === true || n.doNotTrack === '1' || window.doNotTrack === '1') return false;
    if (window.location.protocol !== 'https:') return false;
    if (!['stellaurator.com', 'www.stellaurator.com'].includes(window.location.hostname)) return false;
    let isOwner = owner === '1';
    try { isOwner = isOwner || window.localStorage.getItem('stella.owner') === '1'; } catch { /* storage blocked */ }
    return !isOwner;
  } catch { return false; }
})();
