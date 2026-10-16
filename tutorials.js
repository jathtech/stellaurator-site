// The tutorials page (site/tutorials.html): a chapter time seeks its episode's video and plays it;
// one episode playing pauses the others, so two voices never overlap. Nothing here loads a video on
// its own: every <video> is preload="none" and only plays on a press.
(function () {
  var videos = Array.prototype.slice.call(document.querySelectorAll('.tutorial video'));

  videos.forEach(function (v) {
    v.addEventListener('play', function () {
      videos.forEach(function (o) { if (o !== v && !o.paused) o.pause(); });
    });
  });

  Array.prototype.slice.call(document.querySelectorAll('.tutorial [data-seek]')).forEach(function (b) {
    b.addEventListener('click', function () {
      var article = b.closest('.tutorial');
      var v = article && article.querySelector('video');
      if (!v) return;
      var at = Number(b.getAttribute('data-seek')) || 0;
      var seek = function () {
        try { v.currentTime = at; } catch (e) { /* not seekable yet; the loadedmetadata path below seeks */ }
      };
      if (v.readyState >= 1) {
        seek();
      } else {
        v.addEventListener('loadedmetadata', seek, { once: true });
        v.load();
      }
      var p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* the browser refused to play without a gesture; the controls are there */ });
      v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
})();
