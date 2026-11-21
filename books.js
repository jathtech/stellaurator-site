// Books made with StellAurator (site/wix/README.md section 19): the public list on books.html.
//
// It asks the back office for the live entries: GET <accountSite>/_functions/bookshelf, which answers
// only entries the owner approved, with placement 'made-with', and only their public fields (title,
// author, description, formats, links, cover, and whether a credit was verified). Every value is
// escaped before it is drawn. When the list is empty or the request fails, the page says it is
// opening soon and points to the add page.
//
// The links are the authors' own: they are drawn as they came, with rel="noopener nofollow ugc", and
// they never carry the guides' Amazon marker, so site.js never adds a tag to them. StellAurator earns
// nothing from them.
(() => {
  const cfg = window.STELLA_CONFIG || {};
  const site = cfg.accountSite || 'https://account.stellaurator.com';
  const ADD = 'https://account.stellaurator.com/my-books';
  const EMPTY = 'Books made with StellAurator is opening soon.';
  const FORMATS = { audiobook: 'Audiobook', ebook: 'Ebook', print: 'Print' };
  const shelf = document.querySelector('[data-shelf]');
  const filter = document.querySelector('[data-shelf-filter]');
  if (!shelf) return;

  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // Only https addresses are drawn; the back office cleans them too.
  const safeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.toString() : ''; } catch { return ''; } };
  const safeCover = (u) => (/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.%-]+$/.test(String(u || '')) ? String(u) : '');

  let books = [];
  let format = '';

  function empty() {
    shelf.innerHTML = `<div class="frame panel shelf-empty" data-shelf-empty><p>${esc(EMPTY)} Authors who made their audiobook with StellAurator can add it now; books appear after we look at them.</p>`
      + `<p style="margin-top:14px"><a class="btn btn-gold" href="${ADD}">Add your book</a></p></div>`;
    if (filter) filter.hidden = true;
  }

  function card(b) {
    const cover = safeCover(b.coverUrl);
    const formats = (b.formats || []).map((f) => FORMATS[f]).filter(Boolean).join(' · ');
    const links = (b.links || []).map((l) => ({ url: safeUrl(l && l.url), label: l && l.label })).filter((l) => l.url)
      .map((l) => `<a class="btn btn-line" href="${esc(l.url)}" target="_blank" rel="noopener nofollow ugc">${esc(l.label || new URL(l.url).hostname)}</a>`).join('');
    return `<article class="frame panel shelf-card" data-book>`
      + (cover ? `<img src="${esc(cover)}" alt="Cover of ${esc(b.title)}" loading="lazy" width="96" height="144">` : '<div class="nocover" aria-hidden="true"></div>')
      + `<div><h3>${esc(b.title)}</h3><p class="by">${esc(b.author)}</p>`
      + (formats ? `<p class="fmt">${esc(formats)}</p>` : '')
      + (b.credited ? '<span class="badge" data-credited>Recorded with StellAurator</span>' : '')
      + (b.description ? `<p class="desc">${esc(b.description)}</p>` : '')
      + (links ? `<div class="shelf-links">${links}</div>` : '')
      + '</div></article>';
  }

  function draw() {
    // Only 'made-with' entries reach this page (the back office sends no others). When paid placements
    // come, they will be drawn in a separate section labeled Sponsored, never mixed into this list.
    const shown = books.filter((b) => !format || (b.formats || []).includes(format));
    if (!books.length) { empty(); return; }
    shelf.innerHTML = shown.length ? shown.map(card).join('') : '<p class="muted">No book in this format yet.</p>';
    if (filter) filter.hidden = false;
  }

  if (filter) {
    filter.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-format]');
      if (!b) return;
      format = b.getAttribute('data-format') || '';
      filter.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    });
  }

  fetch(`${site}/_functions/bookshelf`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const list = data && data.ok && Array.isArray(data.books) ? data.books : [];
      // newest first, as the back office sends them; sorted again so the page never depends on it
      books = list.slice().sort((a, b) => new Date(b.listedAt || 0).getTime() - new Date(a.listedAt || 0).getTime());
      draw();
    })
    .catch(() => empty());
})();
