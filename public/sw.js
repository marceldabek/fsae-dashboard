
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const ASSETS = [
	"/",
	"/index.html",
	"/manifest.json",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
];

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
	if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
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
