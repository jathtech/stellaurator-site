// The Console's shapes. Inline SVG, no library, phone width first.
//
// Six of them cover every panel: a stat tile, a day series, a ranked bar list, a ring, a funnel and
// a table. They are deliberately plain - this is a page the owner reads at a bus stop to answer "how
// many, and is it going up", not a data studio.
//
// Three rules they all keep:
//   * the BIG PLAIN TOTAL comes first and the chart second. The owner asked for numbers.
//   * every value is also written down in text. A chart nobody can read the exact figure off is
//     decoration.
//   * a zero is drawn as a zero. A quiet week has to look quiet, not look like missing data - and a
//     figure that does not exist says "not collected" rather than showing 0.

export const el = (tag, attrs, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k === 'class') node.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return node;
};

/** SVG needs its own namespace, or the browser builds an unknown HTML element and draws nothing. */
export const svg = (tag, attrs, ...kids) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) node.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  return node;
};

export const NOT_COLLECTED = 'not collected';
export const num = (n) => (n == null || !Number.isFinite(Number(n)) ? NOT_COLLECTED : Number(n).toLocaleString());
export const pct = (n) => (n == null || !Number.isFinite(Number(n)) ? NOT_COLLECTED : `${Number(n)}%`);

/** '2026-09-20' -> 'Sep 20'. Every series is UTC, and every panel says so once. */
export function shortDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return String(day || '');
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function whenText(iso) {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function dayText(iso) {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/**
 * One big number with a label under it. The Console is mostly these.
 *
 * A value that is not a number (a plan's name, a release tag) is set in the body font instead of
 * the tabular one: "StellAurator Alpha Pass" in a monospace 23px tile breaks mid-word at phone
 * width and reads like a fault.
 */
const NUMERIC = /^[-+]?[\d.,]+%?$|^-$/;
export const stat = (label, value, sub, tone) => el(
  'div',
  { class: `stat${tone ? ` is-${tone}` : ''}${NUMERIC.test(String(value)) ? '' : ' is-text'}`, dataset: { stat: label } },
  el('div', { class: 'stat-value', text: value }),
  el('div', { class: 'stat-label', text: label }),
  sub ? el('div', { class: 'stat-sub', text: sub }) : null,
);

export const stats = (...tiles) => el('div', { class: 'stats' }, tiles.filter(Boolean));

/** A panel. Every one carries the line that says where its numbers come from. */
export const panel = ({ title, note, source, wide }, ...kids) => el(
  'section',
  { class: `panel${wide ? ' is-wide' : ''}`, dataset: { panel: title } },
  el('h2', { text: title }),
  note ? el('p', { class: 'note', text: note }) : null,
  ...kids,
  source ? el('p', { class: 'source', text: source }) : null,
);

export const empty = (text) => el('p', { class: 'empty', text });

/**
 * A day series as bars, with the total written underneath. Days with nothing in them are drawn as
 * an empty column, so a quiet week looks quiet instead of looking like missing data.
 */
export function daySeries(points, { label = '', color = 'var(--gilt)', height = 90 } = {}) {
  const rows = (points || []).filter((p) => p && p.day);
  if (!rows.length) return empty('Nothing in this window yet.');
  const W = 700;
  const H = height;
  const pad = 16;
  const top = Math.max(1, ...rows.map((p) => Number(p.count) || 0));
  const step = (W - pad * 2) / rows.length;
  const gap = rows.length > 90 ? 0.5 : 2;
  const bw = Math.max(1, step - gap);
  const total = rows.reduce((n, p) => n + (Number(p.count) || 0), 0);
  const best = rows.reduce((a, p) => ((Number(p.count) || 0) > (Number(a.count) || 0) ? p : a), rows[0]);
  const bars = rows.map((p, i) => {
    const v = Number(p.count) || 0;
    const h = Math.round(((H - 30) * v) / top);
    return svg('g', {}, svg('title', {}, `${p.day} (UTC): ${v}`), svg('rect', {
      x: pad + i * step, y: H - 14 - h, width: bw, height: Math.max(v > 0 ? 2 : 0, h),
      rx: bw > 4 ? 2 : 0, fill: color, opacity: v ? 0.92 : 0,
    }));
  });
  return el(
    'div',
    { class: 'series', dataset: { series: label } },
    svg(
      'svg',
      { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': `${label || 'Per day'}: ${total} over ${rows.length} days` },
      svg('line', { x1: pad, y1: H - 14, x2: W - pad, y2: H - 14, stroke: 'rgba(199,207,217,.22)', 'stroke-width': 1 }),
      bars,
      svg('text', { x: pad, y: H - 2, fill: 'var(--pewter)', 'font-size': 11 }, shortDay(rows[0].day)),
      svg('text', { x: W - pad, y: H - 2, fill: 'var(--pewter)', 'font-size': 11, 'text-anchor': 'end' }, shortDay(rows[rows.length - 1].day)),
      svg('text', { x: pad, y: 12, fill: 'var(--pewter)', 'font-size': 11 }, `peak ${num(top)}`),
    ),
    el('p', { class: 'caption', text: `${num(total)} over ${rows.length} days (UTC) · busiest day ${shortDay(best.day)} with ${num(best.count)}` }),
  );
}

/** A ranked list as horizontal bars: versions, platforms, plans, batches. */
export function rankedBars(rows, { label = '', max = 12, unit = '', color = 'var(--gilt)', showPercent = true } = {}) {
  const list = (rows || []).slice(0, max);
  if (!list.length) return empty('None yet.');
  const top = Math.max(1, ...list.map((r) => Number(r.count) || 0));
  return el(
    'div',
    { class: 'ranked', dataset: { ranked: label } },
    list.map((r) => el(
      'div',
      { class: 'ranked-row', dataset: { rankedRow: r.key } },
      el('span', { class: 'ranked-key', title: r.key, text: r.key }),
      el('span', { class: 'ranked-bar' }, el('i', { style: `width:${Math.max(1, ((Number(r.count) || 0) / top) * 100)}%;background:${color}` })),
      el('span', { class: 'ranked-num', text: `${num(r.count)}${unit ? ` ${unit}` : ''}${showPercent && r.percent != null ? ` · ${pct(r.percent)}` : ''}` }),
    )),
    (rows || []).length > max ? el('p', { class: 'caption', text: `…and ${(rows || []).length - max} more` }) : null,
  );
}

/** A ring for a share of a whole: "on the newest version", "trials that became plans". */
export function ring(value, of, label, color = 'var(--gilt)') {
  const size = 96;
  const whole = Math.max(0, Number(of) || 0);
  const part = Math.max(0, Math.min(whole, Number(value) || 0));
  const share = whole ? part / whole : 0;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return el(
    'div',
    { class: 'ring', dataset: { ring: label } },
    svg(
      'svg',
      { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': `${label}: ${part} of ${whole}` },
      svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'rgba(199,207,217,.16)', 'stroke-width': 9 }),
      svg('circle', {
        cx: size / 2, cy: size / 2, r, fill: 'none', stroke: color, 'stroke-width': 9, 'stroke-linecap': 'round',
        'stroke-dasharray': `${c * share} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})`,
      }),
      svg('text', { x: size / 2, y: size / 2 + 2, 'text-anchor': 'middle', fill: 'var(--ivory)', 'font-size': 18, 'font-weight': 700 }, whole ? pct(Math.round(share * 1000) / 10) : '-'),
      svg('text', { x: size / 2, y: size / 2 + 17, 'text-anchor': 'middle', fill: 'var(--pewter)', 'font-size': 10 }, `${num(part)} of ${num(whole)}`),
    ),
    el('p', { class: 'caption', text: label }),
  );
}

/** A funnel: made → opened → accepted. Each step against the first, so the drop is visible. */
export function funnel(steps) {
  const rows = (steps || []).map((s) => ({ ...s, value: Number(s.value) || 0 }));
  const top = Math.max(1, ...rows.map((s) => s.value));
  return el('div', { class: 'ranked', dataset: { funnel: 'yes' } }, rows.map((s, i) => el(
    'div',
    { class: 'ranked-row', dataset: { funnelStep: s.label } },
    el('span', { class: 'ranked-key', text: s.label }),
    el('span', { class: 'ranked-bar' }, el('i', { style: `width:${Math.max(1, (s.value / top) * 100)}%;background:${s.color || 'var(--gilt)'}` })),
    el('span', { class: 'ranked-num', text: `${num(s.value)}${i ? ` · ${pct(Math.round((s.value / top) * 1000) / 10)}` : ''}` }),
  )));
}

/** A table that scrolls sideways inside its own panel rather than under the next one. */
export function table(rows, { head = null } = {}) {
  if (!rows || !rows.length) return empty('Nothing here.');
  return el(
    'div',
    { class: 'scroll' },
    el(
      'table',
      {},
      head ? el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))) : null,
      el('tbody', {}, rows.map((cells) => el('tr', { dataset: cells.dataset || {} }, (cells.cells || cells).map((c) => (
        c && c.nodeType ? el('td', {}, c) : el('td', { class: (c && c.class) || '', text: c && c.text != null ? c.text : String(c == null ? '' : c) })
      ))))),
    ),
  );
}

/** The honest empty space: what the owner might look for here and will not find, and why. */
export function notCollected(rows) {
  const list = rows || [];
  if (!list.length) return null;
  return el(
    'section',
    { class: 'panel is-dashed is-wide', dataset: { notCollected: 'yes' } },
    el('h2', { text: 'Not collected' }),
    list.map((r) => el('p', { class: 'note' }, el('strong', { text: r.label }), ` — ${r.why}`)),
  );
}

export const grid = (...kids) => el('div', { class: 'grid' }, kids.filter(Boolean));
