// The Console's service worker — the shell offline, and nothing else.
//
// What it caches is the eleven files that draw the page. What it MUST NEVER cache is an answer
// from the back office: those carry account numbers and support messages, and a cache is a copy
// of them sitting on a phone somebody may pick up. So every request that is not one of this
// app's own files goes to the network and is never stored - and because the Console asks the
// back office by POST, and POSTs are not cacheable at all, that rule is also enforced by the
// browser rather than only by this file.
//
// Why cache anything at all: the owner is often away from the PC, and an installed app that shows
// a browser error page when the train goes into a tunnel does not feel like an app. Offline it
// opens, says it cannot reach the back office, and works again the moment there is signal.
//
// The version below is the cache's name. Bumping it is what retires the old one: a Console whose
// shell half-updated would be the worst kind of bug to debug from a phone, so an update is
// all-or-nothing and takes effect on the next open.
const VERSION = 'console-v2';   // v2: the Alpha page and the alpha's two controls (2026-09-25)

const SHELL = [
  './',
  './index.html',
  './console.css',
  './console.js',
  './charts.js',
  './sections.js',
  './actions.js',
  './reports.js',
  './releases.js',
  './office.js',
  './sign.js',
  './store.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // one missing file must not fail the whole install - the page still works from the network
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== VERSION) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;                       // every back-office call is a POST
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;            // fonts, GitHub: straight to the network
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  // The shell, newest-first: the network wins when it answers, so a republished Console arrives
  // without anybody clearing anything; the cache is what is there when it does not.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (e) {
      const hit = await caches.match(request, { ignoreSearch: true });
      if (hit) return hit;
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
