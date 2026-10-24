// The demos page (site/demos.html): each episode is a poster with a play button (.yt) until it is
// pressed; then YouTube's privacy-enhanced player (youtube-nocookie.com) takes its place, so nothing
// of YouTube's loads before a press. One player is loaded at a time: pressing another episode unloads
// the first, so two voices never overlap. A chapter time loads its episode at that second, or seeks
// the player already loaded (the IFrame API's postMessage commands, enablejsapi=1).
(function () {
  var current = null; // { box, iframe } of the one player loaded

  function embedUrl(id, start) {
    var u = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    if (start > 0) u += '&start=' + Math.floor(start);
    return u;
  }

  function command(iframe, func, args) {
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    } catch (e) { /* the player is not ready; the next press loads it afresh */ }
  }

  function unload() {
    if (!current) return;
    current.iframe.parentNode.removeChild(current.iframe);
    current.box.classList.remove('is-playing');
    current = null;
  }

  // The short demo plays from this site in a <video>; it and the YouTube players take turns, so
  // two sounds never overlap: loading a player pauses the demo, and playing the demo unloads the player.
  var shortDemo = document.querySelector('video[data-short-demo]');
  if (shortDemo) shortDemo.addEventListener('play', unload);

  function load(box, start) {
    if (current && current.box === box) {
      command(current.iframe, 'seekTo', [Math.floor(start || 0), true]);
      command(current.iframe, 'playVideo');
      return;
    }
    unload();
    if (shortDemo && !shortDemo.paused) shortDemo.pause();
    var iframe = document.createElement('iframe');
    iframe.src = embedUrl(box.getAttribute('data-yt'), start || 0);
    iframe.title = (box.getAttribute('data-title') || 'The demo') + ' on YouTube';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    box.appendChild(iframe);
    box.classList.add('is-playing');
    current = { box: box, iframe: iframe };
  }

  Array.prototype.slice.call(document.querySelectorAll('.yt')).forEach(function (box) {
    box.addEventListener('click', function () { load(box, 0); });
  });

  Array.prototype.slice.call(document.querySelectorAll('.episode [data-seek]')).forEach(function (b) {
    b.addEventListener('click', function () {
      var article = b.closest('.episode');
      var box = article && article.querySelector('.yt');
      if (!box) return;
      load(box, Number(b.getAttribute('data-seek')) || 0);
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
})();
