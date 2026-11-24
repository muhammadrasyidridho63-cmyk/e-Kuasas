// Service Worker E-Kuasa.
// - Berkas tampilan (HTML/CSS/JS/ikon) disajikan dari cache SEKETIKA lalu diperbarui di latar (stale-while-revalidate).
// - Permintaan ke Google Apps Script / login Google TIDAK pernah disentuh (selalu langsung ke server).
// - Naikkan VERSI setiap rilis agar pengguna mendapat tawaran "Versi baru tersedia".
const VERSI = '2026.11.24-1';
const CACHE = 'ekuasa-' + VERSI;
const CACHE_FONT = 'ekuasa-font-v1';
const INTI = [
  './', './index.html', './petugas.html', './css/style.css',
  './js/config.js', './js/tema.js', './js/api.js', './js/ui.js', './js/pwa.js', './js/pub.js', './js/off.js',
  './manifest.json', './manifest-petugas.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(INTI.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
  // tidak langsung skipWaiting: halaman yang terbuka diberi tawaran "Muat ulang" agar tidak berganti versi di tengah pengisian form
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.indexOf('ekuasa-') === 0 && k !== CACHE && k !== CACHE_FONT).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (x) { /* abaikan */ } }
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Backend & login Google: jangan pernah di-cache
  if (/(^|\.)script\.google(usercontent)?\.com$|(^|\.)accounts\.google\.com$|(^|\.)googleapis\.com$/.test(url.hostname) && url.hostname !== 'fonts.googleapis.com') return;
  // Font Google: cache-first (berkas font tidak berubah)
  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheDulu(req, CACHE_FONT)); return; }
  if (url.hostname === 'fonts.googleapis.com') { e.respondWith(segarLatar(req, CACHE_FONT)); return; }
  if (url.origin !== self.location.origin) return;
  // Halaman: tampilkan dari cache, perbarui di latar; offline tetap terbuka
  if (req.mode === 'navigate') {
    const kunci = url.pathname.endsWith('petugas.html') ? './petugas.html' : './index.html';
    e.respondWith(segarLatar(new Request(kunci), CACHE, e.preloadResponse));
    return;
  }
  e.respondWith(segarLatar(req, CACHE));
});

async function cacheDulu(req, nama) {
  const c = await caches.open(nama), ada = await c.match(req);
  if (ada) return ada;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}

async function segarLatar(req, nama, preload) {
  const c = await caches.open(nama);
  const ada = await c.match(req, { ignoreSearch: true });
  const ambil = (async () => {
    try {
      const r = (preload && await preload) || await fetch(req, { cache: 'no-cache' });
      if (r && (r.ok || r.type === 'opaque')) await c.put(req, r.clone());
      return r;
    } catch (err) { return null; }
  })();
  if (ada) { ambil.catch(() => null); return ada; }
  const r = await ambil;
  if (r) return r;
  if (req.mode !== 'navigate' && !/\.html$|\/$/.test(new URL(req.url).pathname)) return Response.error();   // berkas lain: gagal biasa
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:32px;text-align:center;color:#0B2545"><h2>Sedang offline</h2><p>Periksa koneksi internet, lalu coba lagi.</p></body>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
