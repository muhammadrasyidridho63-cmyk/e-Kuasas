// Tema warna E-Kuasa. Dimuat di <head> SEBELUM halaman tampil: tema terakhir dari localStorage
// langsung dipasang agar tidak ada kedipan warna. Nilai resmi datang dari server (Pengaturan > TEMA).
(function () {
  // Setiap tema: p = warna utama (gelap), a = aksen emas. Turunan warna dihitung otomatis.
  var TEMA = {
    'navy-emas':   { nama: 'Navy Pengadilan',  ket: 'Bawaan. Biru dongker resmi dengan aksen emas.', p: '#0B2545', a: '#C9A227' },
    'hijau-emas':  { nama: 'Hijau Mahkamah',   ket: 'Hijau tua berwibawa, nuansa lembaga peradilan.', p: '#0F3D2E', a: '#C9A227' },
    'marun-emas':  { nama: 'Marun Klasik',     ket: 'Merah marun hangat dengan emas antik.', p: '#5A1A22', a: '#C29B45' },
    'arang-emas':  { nama: 'Hitam Toga',       ket: 'Hitam arang elegan, emas terang. Kontras tinggi.', p: '#1C1F26', a: '#D4AF37' },
    'biru-emas':   { nama: 'Biru Garuda',      ket: 'Biru kerajaan yang lebih cerah dan modern.', p: '#1E3A6E', a: '#C9A227' },
    'kayu-emas':   { nama: 'Cokelat Ruang Sidang', ket: 'Cokelat kayu mahoni dengan emas lembut.', p: '#3B2416', a: '#BF9B4A' }
  };

  function hex(h) { h = String(h || '').replace('#', ''); return /^[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] : null; }
  function keHex(c) { return '#' + c.map(function (x) { return ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2); }).join(''); }
  function campur(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }); }
  var PUTIH = [255, 255, 255], HITAM = [0, 0, 0];
  function terang(c) { var f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
  function kontras(a, b) { var x = terang(a), y = terang(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  // Gelapkan aksen sampai terbaca di atas latar terang (WCAG 4.5:1)
  function cukupGelap(c, latar) { var t = 0; var r = c; while (kontras(r, latar) < 4.5 && t < 1) { t += .05; r = campur(c, HITAM, t); } return r; }

  function turunan(pHex, aHex) {
    var p = hex(pHex) || hex('#0B2545'), a = hex(aHex) || hex('#C9A227');
    // Warna utama terlalu terang tidak cocok untuk sidebar/teks: paksa cukup gelap
    if (kontras(p, PUTIH) < 7) p = cukupGelapKe(p, 7);
    return {
      '--navy': keHex(p), '--navy-d': keHex(campur(p, HITAM, .35)), '--navy-l': keHex(campur(p, PUTIH, .93)), '--navy-m': keHex(campur(p, PUTIH, .86)),
      '--gold': keHex(a), '--gold-h': keHex(campur(a, HITAM, .12)), '--gold-d': keHex(cukupGelap(campur(a, HITAM, .35), hex('#FDF8E7'))),
      '--gold-l': keHex(campur(a, PUTIH, .91)), '--gold-b': keHex(campur(a, PUTIH, .7)), '--gold-on': keHex(campur(a, PUTIH, .55)),
      '--side-t': keHex(campur(p, PUTIH, .72)), '--shc': p.map(Math.round).join(',')
    };
    function cukupGelapKe(c, target) { var t = 0, r = c; while (kontras(r, PUTIH) < target && t < 1) { t += .05; r = campur(c, HITAM, t); } return r; }
  }

  function pasang(kode, primer, aksen) {
    var t = TEMA[kode];
    var w = kode === 'kustom' && hex(primer) && hex(aksen) ? turunan(primer, aksen) : turunan((t || TEMA['navy-emas']).p, (t || TEMA['navy-emas']).a);
    var s = document.documentElement.style;
    Object.keys(w).forEach(function (k) { s.setProperty(k, w[k]); });
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', w['--navy']);
    return w;
  }


  // ---------- Logo: bentuk + isi (ikon bawaan / gambar unggahan) ----------
  var BENTUK = {
    lencana:   { nama: 'Lencana',          ket: 'Lingkaran bercincin emas, seperti stempel resmi.' },
    lingkaran: { nama: 'Lingkaran',        ket: 'Bulat penuh, bersih dan modern.' },
    kotak:     { nama: 'Kotak Membulat',   ket: 'Bentuk sebelumnya, sudut membulat.' },
    perisai:   { nama: 'Perisai',          ket: 'Bentuk tameng, kesan perlindungan hukum.' },
    polos:     { nama: 'Tanpa Bingkai',    ket: 'Hanya ikon atau gambar, tanpa latar.' }
  };
  var IKON = { gavel: 'Palu hakim', balance: 'Timbangan', account_balance: 'Gedung', policy: 'Dokumen hukum', verified_user: 'Terverifikasi', workspace_premium: 'Lencana', local_police: 'Lambang', shield: 'Perisai' };
  var LOGO = { b: 'lencana', i: 'gavel', g: '' };
  function isiLogo() {
    return LOGO.g ? '<img src="' + LOGO.g + '" alt="" draggable="false">' : '<span class="ms fill" aria-hidden="true">' + (IKON[LOGO.i] ? LOGO.i : 'gavel') + '</span>';
  }
  function tempelLogo(root) {
    var sig = LOGO.b + '|' + LOGO.i + '|' + LOGO.g.length + LOGO.g.slice(-24);
    (root || document).querySelectorAll('.brand-mark:not([data-contoh]),.lgn-mark').forEach(function (el) {
      if (el.getAttribute('data-sig') === sig) return;
      el.setAttribute('data-sig', sig); el.setAttribute('data-bentuk', LOGO.b);
      el.classList.toggle('pakai-gambar', !!LOGO.g);
      el.innerHTML = isiLogo();
    });
  }
  function pasangLogo(bentuk, ikon, gambar) {
    LOGO = { b: BENTUK[bentuk] ? bentuk : 'lencana', i: IKON[ikon] ? ikon : 'gavel', g: /^data:image\/(png|jpeg|webp);base64,/.test(gambar || '') ? gambar : '' };
    document.documentElement.setAttribute('data-logo', LOGO.b);
    if (document.body) tempelLogo();
    // ikon tab browser ikut memakai logo unggahan
    var fav = document.querySelector('link[rel="icon"]');
    if (LOGO.g) { if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); } fav.href = LOGO.g; }
  }
  // Elemen logo yang baru dirender (header, sidebar, login) langsung disesuaikan
  function amati() {
    tempelLogo();
    var antri = false;
    new MutationObserver(function () { if (antri) return; antri = true; requestAnimationFrame(function () { antri = false; tempelLogo(); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) amati(); else document.addEventListener('DOMContentLoaded', amati);

  // Pasang dari cfg server lalu ingat untuk muatan berikutnya
  function dariCfg(cfg) {
    if (!cfg) return;   // server lama tanpa tema/logo: jangan paksa kembali ke bawaan
    var s = {}; try { s = JSON.parse(localStorage.getItem('ek_tema') || '{}') || {}; } catch (e) { s = {}; }
    if (cfg.TEMA) { s.k = cfg.TEMA; s.p = cfg.TEMA_PRIMER || ''; s.a = cfg.TEMA_AKSEN || ''; pasang(s.k, s.p, s.a); }
    if (cfg.LOGO_BENTUK) { s.lb = cfg.LOGO_BENTUK; s.li = cfg.LOGO_IKON || 'gavel'; s.lg = cfg.LOGO_GAMBAR || ''; pasangLogo(s.lb, s.li, s.lg); }
    if (!cfg.TEMA && !cfg.LOGO_BENTUK) return;
    try { localStorage.setItem('ek_tema', JSON.stringify(s)); } catch (e) { /* abaikan */ }
  }

  window.Tema = { daftar: TEMA, pasang: pasang, dariCfg: dariCfg, turunan: turunan, valid: function (h) { return !!hex(h); },
    bentuk: BENTUK, ikon: IKON, pasangLogo: pasangLogo, logo: function () { return { b: LOGO.b, i: LOGO.i, g: LOGO.g }; } };

  try { var s = JSON.parse(localStorage.getItem('ek_tema') || 'null'); if (s) { pasang(s.k, s.p, s.a); pasangLogo(s.lb, s.li, s.lg || ''); } else pasangLogo('lencana', 'gavel', ''); } catch (e) { pasangLogo('lencana', 'gavel', ''); }
})();
