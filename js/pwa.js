// PWA E-Kuasa: daftar service worker, tombol "Pasang Aplikasi", tawaran versi baru, penanda offline.
(function () {
  var root = document.documentElement;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var tundaPasang = null;
  if (standalone) root.classList.add('pwa');
  // iOS tidak punya prompt otomatis: tombol tetap tampil dan membuka petunjuk
  else if (ios) root.classList.add('bisa-pasang');

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); tundaPasang = e; root.classList.add('bisa-pasang'); });
  window.addEventListener('appinstalled', function () {
    tundaPasang = null; root.classList.remove('bisa-pasang');
    if (window.UI) UI.toast('Aplikasi terpasang. Buka dari layar utama HP Anda.', 'ok');
  });

  function petunjukIos() {
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="sheet stack"><h3>Pasang di iPhone / iPad</h3><ol class="pasang-ios"><li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> <span class="ms">ios_share</span> di bawah layar.</li><li>Pilih <b>Tambahkan ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.</li></ol><div class="row" style="justify-content:flex-end"><button class="btn btn-p" type="button" data-n>Mengerti</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-n]')) m.remove(); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pasang]'); if (!b) return;
    e.preventDefault();
    if (tundaPasang) {
      tundaPasang.prompt();
      tundaPasang.userChoice.then(function (r) { if (r.outcome === 'accepted') root.classList.remove('bisa-pasang'); tundaPasang = null; });
    } else if (ios) petunjukIos();
    else if (window.UI) UI.toast('Gunakan menu browser ⋮ lalu pilih "Instal aplikasi" / "Tambahkan ke layar utama".', '');
  });

  // ---------- Penanda offline ----------
  function statusJaringan() {
    var el = document.getElementById('pwaOffline');
    if (navigator.onLine) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'pwaOffline'; el.className = 'pwa-offline'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="ms">wifi_off</span>Anda sedang offline. Data akan dimuat saat koneksi kembali.';
    document.body.appendChild(el);
  }
  window.addEventListener('online', function () { statusJaringan(); if (window.UI) UI.toast('Koneksi kembali.', 'ok'); });
  window.addEventListener('offline', statusJaringan);
  if (document.body) statusJaringan(); else document.addEventListener('DOMContentLoaded', statusJaringan);

  // ---------- Service worker + tawaran versi baru ----------
  if (!('serviceWorker' in navigator) || !/^https:$|^http:$/.test(location.protocol) || (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname))) return;
  function tawarkan(reg) {
    if (!reg.waiting || document.getElementById('pwaBaru')) return;
    var bar = document.createElement('div'); bar.id = 'pwaBaru'; bar.className = 'pwa-baru'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="ms">system_update</span><span class="grow">Versi baru E-Kuasa tersedia.</span><button type="button" class="btn btn-g btn-s">Muat ulang</button><button type="button" class="tutup" aria-label="Nanti saja"><span class="ms">close</span></button>';
    document.body.appendChild(bar);
    bar.querySelector('.btn').onclick = function () { reg.waiting && reg.waiting.postMessage('skipWaiting'); bar.remove(); };
    bar.querySelector('.tutup').onclick = function () { bar.remove(); };
  }
  var muatUlang = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (muatUlang) return; muatUlang = true; location.reload(); });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) tawarkan(reg);
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing; if (!sw) return;
        sw.addEventListener('statechange', function () { if (sw.state === 'installed' && navigator.serviceWorker.controller) tawarkan(reg); });
      });
      // cek pembaruan saat aplikasi dibuka kembali
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { }); });
    }).catch(function () { /* PWA opsional: aplikasi tetap berjalan tanpa service worker */ });
  });
})();
