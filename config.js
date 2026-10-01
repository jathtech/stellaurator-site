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
  contactFallbackEmail: 'mike@stellaurator.com',
  // The invitation page (invite.html) asks the back office what an invitation code is for:
  // the display title, the performer's name, who is inviting and where it stands. Left empty
  // it falls back to accountSite + '/_functions/inviteInfo'. The pairing key is in the link's
  // fragment and is NEVER part of this request.
  inviteEndpoint: '',
  // Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application).
  // Add your site's origin to "Authorized JavaScript origins".
  googleClientId: '',
  // Installer download for signed-in subscribers.
  downloadUrl: '',
};
