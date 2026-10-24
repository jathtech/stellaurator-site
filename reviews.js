// The home page's ratings: "Alpha testers rate how we're doing*" (site/wix/README.md section 18).
//
// Reads https://account.stellaurator.com/_functions/reviews (http-functions.js get_reviews: only the
// ratings whose authors allowed it, first names only, the count and the average over every rating) and
// fills index.html's #reviews. The section stays hidden when there is nothing to show or the answer
// cannot be read, so the page is whole either way. Every word from a rating is set as text, never as HTML.
(() => {
  const host = document.querySelector('[data-reviews]');
  if (!host) return;
  const cfg = window.STELLA_CONFIG || {};
  const endpoint = cfg.reviewsEndpoint || (cfg.accountSite ? `${cfg.accountSite}/_functions/reviews` : '');
  if (!endpoint) return;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = String(text);
    return el;
  };
  const starLine = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  fetch(endpoint, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const list = data && Array.isArray(data.reviews) ? data.reviews : [];
      const count = data && Number.isFinite(Number(data.count)) ? Number(data.count) : 0;
      const average = data && Number.isFinite(Number(data.average)) ? Number(data.average) : 0;
      const cards = host.querySelector('[data-review-cards]');
      if (!list.length || !cards) return;
      const summary = host.querySelector('[data-reviews-summary]');
      if (summary && count) summary.textContent = `${average.toFixed(1)} out of 5, from ${count === 1 ? '1 rating' : `${count} ratings`}.`;
      for (const r of list.slice(0, 30)) {
        const stars = Math.max(1, Math.min(5, Math.round(Number(r && r.stars) || 0)));
        const card = make('figure', 'frame review-card');
        const s = make('p', 'review-stars', starLine(stars));
        s.setAttribute('aria-label', `${stars} out of 5 stars`);
        card.append(s);
        if (r.comment) card.append(make('blockquote', '', r.comment));
        const by = [r.name, r.when].filter(Boolean).join(', ');
        if (by) card.append(make('figcaption', 'review-by', by));
        cards.append(card);
      }
      host.hidden = false;
    })
    .catch(() => { /* no section rather than a broken one */ });
})();
