// Up Next — keeps the app working offline, and quietly picks up updates in the background.
const VERSION = "upnext-1.0.4";
const FONTS = "upnext-fonts";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/base.css", "css/looks.css", "css/watch.css",
  "js/main.js", "js/core.js", "js/dates.js", "js/watch.js", "js/model.js", "js/store.js", "js/views.js", "js/flows.js", "js/ui.js", "js/demo.js", "js/csv.js",
  "js/importers.js", "js/lookup.js", "js/looks.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];
const COVERS = "upnext-posters";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS && k !== COVERS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/(^|\.)tvmaze\.com$/.test(url.hostname) && req.destination === "image") {
    e.respondWith(staleWhileRevalidate(req, COVERS));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});

// The app's own files: fresh from the web when online (so every buyer gets fixes), from the cache when offline or slow.
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const key = new Request(new URL(req.url).pathname);
  const fromCache = async () => (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : null);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; });
  const timeout = new Promise(r => setTimeout(r, 3000));
  try {
    const res = await Promise.race([net, timeout.then(fromCache)]);
    if (res) return res;
    return await net;
  } catch {
    return (await fromCache()) || new Response("You're offline and this page isn't saved yet.", { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName, opts = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, opts) || (req.mode === "navigate" ? await cache.match("index.html") : null);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) cache.put(opts.ignoreSearch ? new Request(new URL(req.url).pathname) : req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || new Response("Offline", { status: 503 });
}
