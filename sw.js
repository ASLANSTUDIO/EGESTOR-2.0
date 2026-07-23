const CACHE = 'egestor-v1';
const STATIC = [
    'index.html',
    'styles.css',
    'script.js',
    'favicon.svg',
    'manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // Always fetch from network for Supabase API
    if (url.hostname.includes('supabase')) return;
    if (url.hostname.includes('googleapis') || url.hostname.includes('cloudflare') || url.hostname.includes('jsdelivr')) {
        // CDN resources: cache-first, update in background
        e.respondWith(
            caches.match(e.request).then(cached => {
                const fetchPromise = fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                    return res;
                }).catch(() => cached);
                return cached || fetchPromise;
            })
        );
        return;
    }
    // Local files: network-first, fallback to cache
    e.respondWith(
        fetch(e.request).then(res => {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return res;
        }).catch(() => caches.match(e.request).then(cached => cached || fetch(e.request)))
    );
});
