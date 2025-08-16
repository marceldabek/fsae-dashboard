// Derive base path from SW scope (handles GitHub Pages like /repo/)
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname.endsWith('/') ? SCOPE.pathname : SCOPE.pathname + '/';

// Increment VERSION on any change that should invalidate old caches.
// v5: auth flow change (redirect) + debugging; force clients to fetch new bundle.
const VERSION = 'v5';
const STATIC_CACHE = `static-${VERSION}`;

// Core assets to precache (exclude index.html so we don't serve stale HTML with old hashed asset names)
const CORE_ASSETS = [
	'manifest.json',
	'icons/icon-192.png',
	'icons/icon-512.png'
].map(p => new URL(BASE + p, self.location.origin).pathname);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE)
			.then(cache => cache.addAll(CORE_ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.filter(k => !k.includes(VERSION)).map(k => caches.delete(k)));
		await self.clients.claim();
	})());
});

// Helper: cache put safely (ignore opaque/error responses)
async function cachePut(cache, req, res) {
	try { if (res && res.status === 200) await cache.put(req, res.clone()); } catch (_) {}
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

	// Network-first for navigations (index.html) so new deployments propagate immediately.
	if (req.mode === 'navigate') {
		event.respondWith((async () => {
			const cache = await caches.open(STATIC_CACHE);
			try {
				const network = await fetch(req);
				await cachePut(cache, req, network);
				return network;
			} catch (_) {
				const cached = await cache.match(req);
				// Fallback: if we never cached index.html yet, try serving a cached root (rare)
				if (cached) return cached;
				// Last resort: offline fallback basic HTML
				return new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
			}
		})());
		return;
	}

	// Stale-while-revalidate for other same-origin static assets
	event.respondWith((async () => {
		const cache = await caches.open(STATIC_CACHE);
		const cached = await cache.match(req);
		const fetchPromise = fetch(req)
			.then(res => { cachePut(cache, req, res); return res; })
			.catch(() => cached);
		return cached || fetchPromise;
	})());
});
