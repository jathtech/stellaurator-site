// Starlight for the StellAurator site: a field of faint stars that breathe,
// and now and then one of them flares into a four-point glint. Canvas 2D,
// ~30 fps, density scaled to the viewport. Under prefers-reduced-motion the
// field is drawn once and stays still.
(() => {
  const c = document.getElementById('stars');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, stars = [], last = 0, raf = 0;

  function seed() {
    const n = Math.round((window.innerWidth * window.innerHeight) / 9000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: (0.35 + Math.random() * 1.05) * dpr,
      a: 0.12 + Math.random() * 0.5,           // resting brightness
      ph: Math.random() * Math.PI * 2,         // twinkle phase
      sp: 0.35 + Math.random() * 1.1,          // twinkle speed
      warm: Math.random() < 0.72,              // gold-white or silver-white
      flare: 0,                                // 0..1 while glinting
      next: 3 + Math.random() * 14,            // seconds until the next glint
    }));
  }
  function resize() {
    W = c.width = Math.round(window.innerWidth * dpr);
    H = c.height = Math.round(window.innerHeight * dpr);
    c.style.width = window.innerWidth + 'px';
    c.style.height = window.innerHeight + 'px';
    seed();
    if (reduce) draw(0, 0);
  }

  function glint(s, k) {
    // a four-point star: two long arms, two short diagonals, a soft core
    const size = (6 + 9 * k) * dpr;
    const alpha = Math.sin(k * Math.PI);        // in, then out
    const rgb = s.warm ? '247,231,176' : '220,228,240';
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalCompositeOperation = 'lighter';
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
    core.addColorStop(0, `rgba(${rgb},${0.75 * alpha})`);
    core.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = core;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.strokeStyle = `rgba(${rgb},${0.9 * alpha})`;
    ctx.lineWidth = Math.max(1, 0.9 * dpr);
    for (const [len, rot] of [[size, 0], [size, Math.PI / 2], [size * 0.42, Math.PI / 4], [size * 0.42, -Math.PI / 4]]) {
      ctx.save(); ctx.rotate(rot);
      const g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * s.sp + s.ph);
      ctx.fillStyle = s.warm ? `rgba(247,231,176,${(s.a * tw).toFixed(3)})` : `rgba(220,228,240,${(s.a * tw).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      if (reduce) continue;
      if (s.flare > 0) {
        glint(s, s.flare);
        s.flare += dt / 1.1;                    // a glint lives ~1.1 s
        if (s.flare >= 1) { s.flare = 0; s.next = 4 + Math.random() * 18; }
      } else {
        s.next -= dt;
        if (s.next <= 0) s.flare = 0.001;
      }
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    if (now - last >= 33) { last = now; draw(now / 1000, dt); }
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else if (!reduce && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  resize();
  if (!reduce) raf = requestAnimationFrame(frame);
})();
