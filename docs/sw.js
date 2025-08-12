// Derive base path from SW scope (handles GitHub Pages like /repo/)
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname.endsWith('/') ? SCOPE.pathname : SCOPE.pathname + '/';
const VERSION = "v2"; // bump to bust old caches after changes
const STATIC_CACHE = `static-${VERSION}`;
const ASSETS = [
	"",
	"index.html",
	"manifest.json",
	"icons/icon-192.png",
	"icons/icon-512.png",
].map((p) => new URL(BASE + p, self.location.origin).pathname);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => !k.includes(VERSION)).map((k) => caches.delete(k)));
			await self.clients.claim();
		})()
	);
});

// Stale-while-revalidate for same-origin GET requests (static assets)
self.addEventListener("fetch", (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
	event.respondWith(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			const cached = await cache.match(req);
			const network = fetch(req)
				.then((res) => {
					if (res && res.status === 200) cache.put(req, res.clone());
					return res;
				})
				.catch(() => cached);
			return cached || network;
		})()
	);
});
