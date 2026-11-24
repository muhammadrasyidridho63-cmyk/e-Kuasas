// Dashboard petugas E-Kuasa: login, ringkasan, antrean, detail verifikasi, laporan, admin.
// Seluruh daftar dimuat sekali (cache sesi + versi data), lalu disaring/dihalaman di browser agar klik terasa instan.
(function () {
  var esc = UI.esc, ic = UI.ic, $ = UI.$;
  var APP = $('#app');
  var JENIS_BAYAR = 'Bukti Bayar PNBP', JENIS_LEGAL = 'Dokumen Legalisasi';
  var STATUSES = ['Menunggu Berkas', 'Menunggu Pembayaran', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Terlegalisasi'];
  var KELOMPOK = { ADV: 'Advokat', INS: 'Instansi', INC: 'Insidentil' };

  var O = {
    user: null, boot: null, rows: [], v: '', wajib: {}, loaded: false,
    f: { q: '', kel: '', st: '', dari: '', sampai: '' }, page: 1, per: 10, mode: 'ringkasan',
    det: {}, prev: {}, cur: null, route: '', timer: null, tab: 'petugas', lastSync: 0, loginSig: ''
  };

  // ---------- Panggilan API: sesi berakhir -> kembali ke login ----------
  async function api(a, d, opt) {
    try { return await Api.call(a, d, opt); }
    catch (e) { if (e.code === 'SESI' && O.user) { keluar(true); } throw e; }
  }

  // ============================================================
  // LOGIN
  // ============================================================
  // Latar panel kiri: fasad gedung kaca dalam perspektif (SVG, ikut warna tema, tanpa gambar dari luar)
  var FASAD = (function () {
    var vp = [700, 40], out = '';
    function titik(bx, by, t) { return [vp[0] + (bx - vp[0]) * t, vp[1] + (by - vp[1]) * t]; }
    function poli(a, b, c, d, op, garis) {
      return '<path d="M' + [a, b, c, d].map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z" fill="#fff" fill-opacity="' + op + '" stroke="' + (garis || '#fff') + '" stroke-opacity="' + (garis ? .55 : .14) + '" stroke-width="' + (garis ? 1.4 : 1) + '"/>';
    }
    var T_ = [1, .74, .55, .41, .3, .22];               // kedalaman lantai (perspektif)
    var dinding = [[[-200, 1000], [520, 1000]], [[520, 1000], [1000, 1000]], [[-200, 1000], [-200, 120]]];
    dinding.forEach(function (w, wi) {
      var kol = wi === 2 ? 5 : 7;
      for (var c = 0; c < kol; c++) {
        var u0 = c / kol, u1 = (c + 1) / kol;
        var b0 = [w[0][0] + (w[1][0] - w[0][0]) * u0, w[0][1] + (w[1][1] - w[0][1]) * u0];
        var b1 = [w[0][0] + (w[1][0] - w[0][0]) * u1, w[0][1] + (w[1][1] - w[0][1]) * u1];
        for (var r = 0; r < T_.length - 1; r++) {
          var s = (c * 7 + r * 3 + wi * 5) % 9;
          var op = [.02, .05, .09, .03, .12, .06, .015, .08, .04][s];
          var emas = (wi === 0 && c === 4 && r === 1) || (wi === 1 && c === 2 && r === 2) ? 'var(--gold)' : '';
          out += poli(titik(b0[0], b0[1], T_[r]), titik(b1[0], b1[1], T_[r]), titik(b1[0], b1[1], T_[r + 1]), titik(b0[0], b0[1], T_[r + 1]), emas ? .1 : op, emas);
        }
      }
    });
    out += '<path d="M700 40 L-200 1000" stroke="var(--gold)" stroke-opacity=".5" stroke-width="1.2"/><path d="M700 40 L520 1000" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>';
    return '<svg class="lgn-bg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="lgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--navy)"/><stop offset="1" stop-color="var(--navy-d)"/></linearGradient>' +
      '<linearGradient id="lgFade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="var(--navy-d)" stop-opacity="0"/><stop offset="1" stop-color="var(--navy-d)" stop-opacity=".92"/></linearGradient>' +
      '<radialGradient id="lgShine" cx=".85" cy=".05" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="800" height="1000" fill="url(#lgGrad)"/>' + out + '<rect width="800" height="1000" fill="url(#lgShine)"/><rect width="800" height="1000" fill="url(#lgFade)"/></svg>';
  })();
  var SLIDE = [
    ['Verifikasi Lebih Cepat. Legalisasi Lebih Tertib.', 'Periksa berkas surat kuasa, minta perbaikan, dan unggah dokumen legalisasi dari satu dashboard.'],
    ['Tanpa Antre. Tanpa Berkas Hilang.', 'Pemohon mengunggah persyaratan secara daring, dan setiap langkah verifikasi tercatat dalam riwayat.'],
    ['Rapi di Laptop maupun Ponsel.', 'Antrean, laporan per kelompok kuasa, dan ekspor buku register siap kapan saja.']
  ];
  function geserSlide(n) {
    var h = $('#lgH'), s = $('#lgS'); if (!h) { clearInterval(O.lgTimer); return; }
    O.lgIdx = (n + SLIDE.length) % SLIDE.length;
    var box = $('.lgn-copy'); box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    h.textContent = SLIDE[O.lgIdx][0]; s.textContent = SLIDE[O.lgIdx][1];
    UI.$$('.lgn-dots button').forEach(function (b, i) { b.classList.toggle('on', i === O.lgIdx); b.setAttribute('aria-current', i === O.lgIdx); });
  }

  function renderLogin() {
    var b = O.boot || {};
    var sig = JSON.stringify([b.googleClientId, b.darurat, b.sandi, (b.cfg || {}).NAMA_INSTANSI]);
    if (sig === O.loginSig && $('.lgn')) return;
    O.loginSig = sig;
    var inst = (b.cfg && b.cfg.NAMA_INSTANSI) || 'Pengadilan Tata Usaha Negara';
    var adaForm = b.darurat || b.sandi;
    var form = adaForm ? '<form id="fdar" class="lgn-form" autocomplete="on">' +
      '<label class="lgn-f"><span>Nama pengguna</span><input class="input" name="user" autocomplete="username" placeholder="Masukkan nama pengguna" required></label>' +
      '<label class="lgn-f"><span>Sandi</span><span class="lgn-pw"><input class="input" type="password" name="pass" id="lgPass" autocomplete="current-password" placeholder="Masukkan sandi" required>' +
      '<button type="button" class="lgn-eye" id="lgEye" aria-label="Tampilkan sandi" aria-pressed="false">' + ic('visibility') + '</button></span></label>' +
      '<div class="lgn-row"><span class="lgn-muted">' + ic('shield_lock') + 'Sesi aman 12 jam</span><button type="button" class="lgn-link" id="lgLupa" aria-expanded="false">Lupa sandi?</button></div>' +
      '<p class="lgn-note" id="lgNote" hidden>Hubungi Admin untuk mengatur ulang sandi Anda (menu Admin &rsaquo; Petugas &rsaquo; Ubah). Sandi akses darurat dibuat ulang oleh pemilik Apps Script lewat fungsi <b>resetAksesDarurat</b>.</p>' +
      '<button class="lgn-btn">Masuk</button></form>' : '';
    var google = b.googleClientId ? '<div id="gbtn" class="lgn-g"></div>' :
      (adaForm ? '' : '<div class="banner" style="margin:0">' + ic('info') + '<div class="small">Belum ada cara masuk yang aktif. Isi GOOGLE_CLIENT_ID atau jalankan resetAksesDarurat di Apps Script.</div></div>');
    var pemisah = adaForm && b.googleClientId ? '<div class="lgn-or"><span>atau lanjutkan dengan</span></div>' : '';
    APP.innerHTML = '<div class="lgn">' +
      '<section class="lgn-hero">' + FASAD +
        '<div class="lgn-top"><a class="lgn-brand" href="index.html"><span class="lgn-mark">' + ic('gavel', 'fill') + '</span><span>E-Kuasa<small>' + esc(inst) + '</small></span></a>' +
        '<a class="lgn-back" href="index.html">' + ic('arrow_back') + '<span>Kembali ke Portal</span></a></div>' +
        '<div class="lgn-copy in"><h2 id="lgH">' + esc(SLIDE[0][0]) + '</h2><p id="lgS">' + esc(SLIDE[0][1]) + '</p>' +
        '<div class="lgn-dots" role="group" aria-label="Pilih slide">' + SLIDE.map(function (x, i) { return '<button type="button" data-i="' + i + '" class="' + (i ? '' : 'on') + '" aria-label="Slide ' + (i + 1) + '"></button>'; }).join('') + '</div></div>' +
      '</section>' +
      '<section class="lgn-side"><div class="lgn-card">' +
        '<h1>Selamat Datang Kembali!</h1><p class="lgn-sub">Masuk untuk memverifikasi dan melegalisasi surat kuasa.</p>' +
        form + pemisah + google +
        '<p class="lgn-foot">Bukan petugas? <a href="index.html">Kembali ke portal pemohon</a></p>' +
      '</div></section></div>';
    O.lgIdx = 0; clearInterval(O.lgTimer);
    if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: reduce)').matches) O.lgTimer = setInterval(function () { geserSlide(O.lgIdx + 1); }, 6000);
    if (b.googleClientId) muatGoogle(b.googleClientId);
  }
  APP.addEventListener('click', function (e) {
    var d = e.target.closest('.lgn-dots button');
    if (d) { clearInterval(O.lgTimer); geserSlide(Number(d.dataset.i)); return; }
    if (e.target.closest('#lgEye')) {
      var inp = $('#lgPass'), eye = $('#lgEye'), lihat = inp.type === 'password';
      inp.type = lihat ? 'text' : 'password'; eye.setAttribute('aria-pressed', lihat); eye.setAttribute('aria-label', lihat ? 'Sembunyikan sandi' : 'Tampilkan sandi');
      eye.innerHTML = ic(lihat ? 'visibility_off' : 'visibility'); return;
    }
    if (e.target.closest('#lgLupa')) { var n = $('#lgNote'); n.hidden = !n.hidden; $('#lgLupa').setAttribute('aria-expanded', !n.hidden); }
  });
  function muatGoogle(cid) {
    var init = function () {
      if (!window.google || !google.accounts || !$('#gbtn')) return;
      google.accounts.id.initialize({ client_id: cid, callback: onGoogle, auto_select: false });
      var lebar = Math.max(220, Math.min(400, Math.floor($('#gbtn').getBoundingClientRect().width || 320)));
      google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: lebar, logo_alignment: 'center', locale: 'id' });
    };
    if (window.google && google.accounts) return init();
    if (document.getElementById('gsi')) return;
    var s = document.createElement('script'); s.id = 'gsi'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.onload = init;
    document.head.appendChild(s);
  }
  async function onGoogle(resp) {
    var g = $('#gbtn'); if (g) g.style.opacity = '.5';
    try {
      var r = await Api.call('auth.google', { idToken: resp.credential });
      Api.setToken(r.token); O.user = r.user; masukApp();
    } catch (e) { UI.toast(e.message, 'err'); if (g) g.style.opacity = '1'; }
  }
  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('#fdar'); if (!f) return;
    e.preventDefault();
    var btn = f.querySelector('.lgn-btn'); UI.busy(btn, true, 'Memeriksa...');
    try {
      var r = await Api.call('auth.darurat', { user: f.user.value, pass: f.pass.value });
      Api.setToken(r.token); O.user = r.user; masukApp();
    } catch (err) { UI.toast(err.message, 'err'); UI.busy(btn, false); }
  });

  function keluar(sesiHabis) {
    clearInterval(O.timer);
    Api.setToken(''); Api.cacheClear();
    Object.keys(O.prev).forEach(function (k) { try { URL.revokeObjectURL(O.prev[k].url); } catch (e) { /* abaikan */ } });
    O = Object.assign(O, { user: null, rows: [], v: '', loaded: false, det: {}, prev: {}, cur: null, loginSig: '' });
    if (window.google && google.accounts) { try { google.accounts.id.disableAutoSelect(); } catch (e) { /* abaikan */ } }
    renderLogin();
    if (sesiHabis) UI.toast('Sesi berakhir. Silakan masuk kembali.', 'warn');
  }

  // ============================================================
  // SHELL
  // ============================================================
  function menu() {
    var m = [['ringkasan', 'space_dashboard', 'Ringkasan', '#/'], ['antrean', 'pending_actions', 'Antrean Verifikasi', '#/antrean'], ['laporan', 'bar_chart', 'Laporan', '#/laporan']];
    if (O.user.peran === 'Admin') m.push(['admin', 'admin_panel_settings', 'Admin', '#/admin']);
    return m;
  }
  function masukApp() {
    clearInterval(O.lgTimer);
    var m = menu();
    var nav = m.map(function (x) { return '<a href="' + x[3] + '" data-r="' + x[0] + '">' + ic(x[1]) + '<span>' + x[2] + '</span></a>'; }).join('');
    var tab = m.map(function (x) { return '<a href="' + x[3] + '" data-r="' + x[0] + '">' + ic(x[1]) + (x[2] === 'Antrean Verifikasi' ? 'Antrean' : x[2]) + '</a>'; }).join('');
    APP.innerHTML = '<div class="shell"><aside class="side"><a class="brand" href="#/"><span class="brand-mark">' + ic('gavel', 'fill') + '</span><span class="brand-t"><b>E-Kuasa</b><span>Dashboard Petugas</span></span></a><nav>' + nav + '</nav>' +
      '<div class="me"><span class="ico" style="background:var(--navy)">' + ic('person') + '</span><div class="grow"><b>' + esc(O.user.nama || 'Petugas') + '</b><span>' + esc(O.user.peran) + ' &middot; ' + esc(O.user.email) + '</span></div>' + (O.user.username ? '<button data-act="gantiSandi" title="Ganti sandi" aria-label="Ganti sandi">' + ic('key') + '</button>' : '') + '<button data-act="keluar" title="Keluar" aria-label="Keluar">' + ic('logout') + '</button></div></aside>' +
      '<div class="main"><header class="bar-top"><div class="row"><span class="brand-mark mob-only">' + ic('gavel', 'fill') + '</span><b id="judul" style="color:var(--navy)"></b></div><div class="row"><span id="sync" class="tiny muted"></span><button class="btn btn-t btn-s" data-act="muat" aria-label="Muat ulang data">' + ic('refresh') + '</button>' + (O.user.username ? '<button class="btn btn-t btn-s mob-only" data-act="gantiSandi" aria-label="Ganti sandi">' + ic('key') + '</button>' : '') + '<button class="btn btn-t btn-s mob-only" data-act="keluar" aria-label="Keluar">' + ic('logout') + '</button></div></header>' +
      '<div class="content" id="v"></div></div><nav class="tabbar off-tab">' + tab + '</nav></div>';
    $('.shell').addEventListener('click', klik);
    $('#v').addEventListener('input', onInput);
    $('#v').addEventListener('change', onChange);
    $('#v').addEventListener('submit', onSubmit);
    window.removeEventListener('hashchange', tampil); window.addEventListener('hashchange', tampil);
    muatList();
    tampil();
    clearInterval(O.timer);
    O.timer = setInterval(function () { if (document.visibilityState === 'visible' && O.user && /^(ringkasan|antrean|laporan)$/.test(O.route)) muatList(); }, 30000);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && O.user && Date.now() - O.lastSync > 15000) muatList(); });

  // ---------- Data daftar: cache sesi -> segarkan hanya bila versi berubah ----------
  function muatList() {
    return Api.swr('off.list', async function () {
      var r = await api('off.list', { v: O.v });
      if (r.unchanged) return { v: r.v, rows: O.rows, wajib: O.wajib, tema: r.tema };
      return r;
    }, function (d, cache) {
      var ganti = d.v !== O.v || !O.loaded;
      O.rows = d.rows || []; O.v = d.v; O.wajib = d.wajib || {}; O.loaded = true;
      if (d.tema && window.Tema && !(O.route === 'admin' && (O.tab === 'tema' || O.tab === 'logo'))) Tema.dariCfg(d.tema);   // tema terbaru ikut tiap sinkron
      if (!cache) { O.lastSync = Date.now(); var s = $('#sync'); if (s) s.textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':'); }
      if (ganti) segarkanLayar();
    }, 'session').catch(function (e) { if (O.user && e.code !== 'SESI') UI.toast(e.message, 'err'); });
  }
  function segarkanLayar() {
    if (O.route === 'ringkasan' || O.route === 'antrean') { renderKpi(); renderTabel(); }
    else if (O.route === 'laporan') renderLaporan();
  }

  // ---------- Router ----------
  function parseRute() {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var n = h[0] || 'ringkasan';
    if (['ringkasan', 'antrean', 'detail', 'laporan', 'admin'].indexOf(n) < 0) n = 'ringkasan';
    if (n === 'admin' && O.user.peran !== 'Admin') n = 'ringkasan';
    return { n: n, p: decodeURIComponent(h[1] || '') };
  }
  var JUDUL = { ringkasan: 'Ringkasan Berkas', antrean: 'Antrean Verifikasi', detail: 'Verifikasi Berkas', laporan: 'Laporan', admin: 'Administrasi' };
  function tampil() {
    if (!O.user) return;
    var r = parseRute();
    if (r.n !== 'admin') { kembalikanTema(); kembalikanLogo(); }
    O.route = r.n;
    UI.$$('.side nav a,.tabbar a').forEach(function (a) { a.classList.toggle('on', a.dataset.r === (r.n === 'detail' ? 'antrean' : r.n)); });
    $('#judul').textContent = JUDUL[r.n];
    var v = $('#v'); v.classList.remove('view'); void v.offsetWidth; v.classList.add('view');
    if (r.n === 'ringkasan' || r.n === 'antrean') vList(r.n);
    else if (r.n === 'detail') vDetail(r.p);
    else if (r.n === 'laporan') vLaporan();
    else vAdmin();
    window.scrollTo(0, 0);
  }

  // ============================================================
  // RINGKASAN & ANTREAN
  // ============================================================
  function vList(mode) {
    if (O.mode !== mode) { O.mode = mode; O.f.st = mode === 'antrean' ? 'Menunggu Verifikasi' : ''; O.page = 1; }
    var f = O.f;
    var opsiSt = '<option value="">Semua Status</option>' + STATUSES.map(function (s) { return '<option ' + (f.st === s ? 'selected' : '') + '>' + s + '</option>'; }).join('');
    var opsiKel = '<option value="">Semua Kelompok</option>' + Object.keys(KELOMPOK).map(function (k) { return '<option value="' + k + '" ' + (f.kel === k ? 'selected' : '') + '>' + k + ' (' + KELOMPOK[k] + ')</option>'; }).join('');
    $('#v').innerHTML = '<div class="stack">' +
      '<div class="card row wrap-r" style="gap:14px"><span class="ico big" style="border-radius:12px;width:52px;height:52px">' + ic('shield_person') + '</span><div class="grow"><div class="row wrap-r"><h2 style="font-size:20px">Selamat bertugas, ' + esc((O.user.nama || 'Petugas').split(' ')[0]) + '</h2><span class="pill">' + ic('check_circle', 'fill') + 'Sesi aktif</span></div><p class="muted small">' + new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) + '</p></div></div>' +
      '<div class="grid g4" id="kpi"></div>' +
      '<div class="card filters"><input class="input" id="fq" placeholder="Cari ID, pemohon, advokat/instansi..." value="' + esc(f.q) + '" aria-label="Cari"><select class="input" id="fkel" aria-label="Kelompok">' + opsiKel + '</select><select class="input" id="fst" aria-label="Status">' + opsiSt + '</select>' +
      '<input class="input" type="date" id="fdari" value="' + esc(f.dari) + '" aria-label="Dari tanggal"><input class="input" type="date" id="fsampai" value="' + esc(f.sampai) + '" aria-label="Sampai tanggal"></div>' +
      '<div class="tbl-wrap"><div id="tbl"></div></div></div>';
    renderKpi(); renderTabel();
  }
  function hitung() {
    var c = {}; STATUSES.forEach(function (s) { c[s] = 0; });
    O.rows.forEach(function (r) { c[r.s] = (c[r.s] || 0) + 1; });
    return c;
  }
  function renderKpi() {
    var el = $('#kpi'); if (!el) return;
    if (!O.loaded) { el.innerHTML = [1, 2, 3, 4].map(function () { return '<div class="card"><div class="sk" style="height:60px"></div></div>'; }).join(''); return; }
    var c = hitung();
    var k = function (cls, l, v, ik, st) { return '<button class="card kpi hover ' + cls + '" style="text-align:left;cursor:pointer" data-act="kpi" data-st="' + esc(st) + '"><span class="ico">' + ic(ik) + '</span><div class="l">' + l + '</div><div class="v">' + v + '</div></button>'; };
    el.innerHTML = k('', 'Total Pendaftaran', O.rows.length, 'folder_managed', '') + k('warn', 'Menunggu Verifikasi', c['Menunggu Verifikasi'], 'pending_actions', 'Menunggu Verifikasi') +
      k('err', 'Perlu Perbaikan', c['Perlu Perbaikan'], 'assignment_late', 'Perlu Perbaikan') + k('ok', 'Terlegalisasi', c['Terlegalisasi'], 'verified', 'Terlegalisasi');
  }
  function tgl(t) { return new Date(new Date(t).getTime() + 7 * 3600e3).toISOString().slice(0, 10); }
  function saring() {
    var f = O.f, q = f.q.trim().toLowerCase();
    var r = O.rows.filter(function (x) {
      if (f.kel && x.k !== f.kel) return false;
      if (f.st && x.s !== f.st) return false;
      if (q && (x.id + ' ' + x.p + ' ' + x.a).toLowerCase().indexOf(q) < 0) return false;
      if (f.dari || f.sampai) { var d = tgl(x.t); if ((f.dari && d < f.dari) || (f.sampai && d > f.sampai)) return false; }
      return true;
    });
    if (O.mode === 'antrean') r = r.slice().sort(function (a, b) { return a.t < b.t ? -1 : 1; }); // terlama dulu
    return r;
  }
  function renderTabel() {
    var el = $('#tbl'); if (!el) return;
    if (!O.loaded) { el.innerHTML = '<div style="padding:16px">' + [1, 2, 3, 4, 5].map(function () { return '<div class="sk" style="height:44px;margin-bottom:8px"></div>'; }).join('') + '</div>'; return; }
    var r = saring(), total = r.length, hal = Math.max(1, Math.ceil(total / O.per));
    if (O.page > hal) O.page = hal;
    var mulai = (O.page - 1) * O.per, bagian = r.slice(mulai, mulai + O.per);
    if (!total) { el.innerHTML = '<div class="empty">' + ic('inbox') + '<b>Belum ada pendaftaran</b><p class="small">Tidak ada data yang cocok dengan filter saat ini.</p></div>'; return; }
    var rows = bagian.map(function (x) {
      var w = O.wajib[x.k] || 0;
      var aksi = x.s === 'Menunggu Verifikasi' ? '<span class="btn btn-p btn-s">' + ic('assignment_turned_in') + 'Verifikasi</span>' : '<span class="btn btn-o btn-s">' + ic('visibility') + 'Detail</span>';
      return '<tr class="click" data-act="buka" data-id="' + esc(x.id) + '"><td data-l="ID"><span class="mono" style="color:var(--navy)">' + esc(x.id) + '</span></td><td data-l="Tanggal" class="small muted">' + UI.tgl(x.t, true) + '</td>' +
        '<td data-l="Kelompok"><span class="chip">' + esc(x.k) + '</span></td><td data-l="Pemohon"><b>' + esc(x.p) + '</b></td><td data-l="Penerima" class="muted">' + esc(x.a) + '</td>' +
        '<td data-l="Berkas" class="small">' + x.n + '/' + w + (x.b ? ' + bayar' : ' <span class="muted">(belum bayar)</span>') + '</td><td data-l="Status">' + UI.status(x.s) + '</td><td data-l="Aksi" style="text-align:right">' + aksi + '</td></tr>';
    }).join('');
    var pg = '';
    var lo = Math.max(1, O.page - 2), hi = Math.min(hal, lo + 4); lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) pg += '<button class="' + (i === O.page ? 'on' : '') + '" data-act="hal" data-p="' + i + '" aria-label="Halaman ' + i + '">' + i + '</button>';
    el.innerHTML = '<div class="tbl-scroll"><table class="t stack"><thead><tr><th>ID Registrasi</th><th>Tanggal</th><th>Kelompok</th><th>Pemohon</th><th>Advokat / Instansi</th><th>Berkas</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="pager"><span class="small muted">Menampilkan <b>' + (mulai + 1) + '-' + (mulai + bagian.length) + '</b> dari <b>' + total + '</b> pendaftaran</span><div class="pg"><button data-act="hal" data-p="' + (O.page - 1) + '" ' + (O.page <= 1 ? 'disabled' : '') + ' aria-label="Sebelumnya">' + ic('chevron_left') + '</button>' + pg + '<button data-act="hal" data-p="' + (O.page + 1) + '" ' + (O.page >= hal ? 'disabled' : '') + ' aria-label="Berikutnya">' + ic('chevron_right') + '</button></div></div>';
  }

  var tundaQ = UI.debounce(function () { O.page = 1; renderTabel(); }, 120);
  function onInput(e) {
    var tid = e.target.id;
    if (O.temaPilih && /^tm[PA]h?$/.test(tid)) {
      var v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v;
      if (!Tema.valid(v)) return;
      O.temaPilih[tid.charAt(2) === 'P' ? 'p' : 'a'] = v.toUpperCase();
      var kembar = { tmP: 'tmPh', tmPh: 'tmP', tmA: 'tmAh', tmAh: 'tmA' }[tid];
      if ($('#' + kembar)) $('#' + kembar).value = v.toLowerCase();
      Tema.pasang('kustom', O.temaPilih.p, O.temaPilih.a);           // pratinjau langsung tanpa render ulang
      UI.$$('[data-act="temaBatal"],[data-act="temaSimpan"]').forEach(function (x) { x.classList.remove('off'); });
      return;
    }
    if (e.target.id === 'fq') { O.f.q = e.target.value; tundaQ(); }
  }
  function onChange(e) {
    var t = e.target;
    if (O.temaPilih && /^tm[PA]h?$/.test(t.id)) { renderTema(); return; }
    if (t.id === 'fkel') { O.f.kel = t.value; O.page = 1; renderTabel(); }
    else if (t.id === 'fst') { O.f.st = t.value; O.page = 1; renderTabel(); }
    else if (t.id === 'fdari') { O.f.dari = t.value; O.page = 1; renderTabel(); }
    else if (t.id === 'fsampai') { O.f.sampai = t.value; O.page = 1; renderTabel(); }
    else if (t.id === 'lgDari' || t.id === 'lgSampai' || t.id === 'lgKel') { O.lg = O.lg || {}; O.lg[t.id] = t.value; renderLaporan(); }
    else if (t.matches && t.matches('input[data-logo-file]')) {
      var fl = t.files[0]; t.value = ''; if (!fl) return;
      kecilkanLogo(fl).then(function (g) { O.logoPilih.g = g; pratinjauLogo(); UI.toast('Gambar siap. Klik Simpan Logo untuk menerapkan.', ''); })
        .catch(function (err) { UI.toast(err.message, 'err'); });
    }
    else if (t.matches && t.matches('input[data-legal]')) uploadLegal(t);
  }

  // ============================================================
  // DETAIL VERIFIKASI
  // ============================================================
  function selesaiSemua(d) {
    var ada = {}; d.berkas.forEach(function (b) { ada[b.jenis] = b; });
    var wajib = d.syarat.filter(function (s) { return s.wajib; }).map(function (s) { return s.jenis; }).concat([JENIS_BAYAR]);
    return wajib.every(function (j) { return ada[j] && ada[j].status === 'Sesuai'; });
  }
  function skeletonDetail(id) {
    var r = O.rows.filter(function (x) { return x.id === id; })[0];
    return '<div class="stack"><a class="btn btn-t btn-s" href="#/antrean" style="align-self:flex-start">' + ic('arrow_back') + 'Kembali</a>' +
      '<div class="card"><div class="row between wrap-r"><div class="big-id" style="font-size:22px">' + esc(id) + '</div>' + (r ? UI.status(r.s) : '') + '</div>' + (r ? '<p class="muted small" style="margin-top:6px">' + esc(r.p) + ' &middot; ' + esc(r.a) + '</p>' : '') + '</div>' +
      '<div class="card"><div class="sk" style="height:90px;margin-bottom:8px"></div><div class="sk" style="height:90px"></div></div></div>';
  }
  async function vDetail(id) {
    id = (id || '').toUpperCase();
    O.cur = null;
    var c = O.det[id];
    if (c && Date.now() - c.t < 20000) { O.cur = c.d; renderDetail(); }
    else $('#v').innerHTML = skeletonDetail(id);
    try {
      var d = await api('off.detail', { id: id });
      O.det[id] = { t: Date.now(), d: d };
      if (O.route !== 'detail' || parseRute().p.toUpperCase() !== id) return;
      O.cur = d; renderDetail();
      var pertama = d.berkas.filter(function (b) { return b.jenis !== JENIS_LEGAL; })[0];
      if (pertama && d.status === 'Menunggu Verifikasi') lihat(id, pertama.jenis, true);
    } catch (e) {
      if (O.route === 'detail') $('#v').innerHTML = '<div class="stack"><a class="btn btn-t btn-s" href="#/">' + ic('arrow_back') + 'Kembali</a><div class="banner err">' + ic('error') + '<div>' + esc(e.message) + '</div></div></div>';
    }
  }
  function renderDetail() {
    var d = O.cur; if (!d) return;
    var editable = d.status === 'Menunggu Verifikasi';
    var ada = {}; d.berkas.forEach(function (b) { ada[b.jenis] = b; });
    var jenis = d.syarat.map(function (s) { return s.jenis; }).concat([JENIS_BAYAR]);
    if (ada[JENIS_LEGAL]) jenis.push(JENIS_LEGAL);
    var daftar = jenis.map(function (j) {
      var b = ada[j];
      if (!b) return '<div class="fv"><div class="row between"><b>' + esc(j) + '</b><span class="pill gray">Belum diunggah</span></div></div>';
      var legal = j === JENIS_LEGAL;
      return '<div class="fv" data-j="' + esc(j) + '"><div class="row between" style="gap:8px"><div style="min-width:0"><b>' + esc(j) + '</b><div class="tiny muted" style="word-break:break-all">' + UI.ukuran(b.ukuran) + ' &middot; ' + UI.tgl(b.waktu, true) + '</div></div>' + (legal ? '<span class="pill ok">' + ic('verified', 'fill') + 'Resmi</span>' : UI.vstat(b.status)) + '</div>' +
        '<div class="row wrap-r" style="margin-top:10px"><button class="btn btn-o btn-s" data-act="lihat" data-j="' + esc(j) + '">' + ic('visibility') + 'Lihat</button>' +
        (editable && !legal ? '<div class="seg" role="group" aria-label="Hasil verifikasi ' + esc(j) + '"><button class="' + (b.status === 'Sesuai' ? 'on ok' : '') + '" data-act="sesuai" data-j="' + esc(j) + '">Sesuai</button><button class="' + (b.status === 'Tidak Sesuai' ? 'on bad' : '') + '" data-act="tidak" data-j="' + esc(j) + '">Tidak Sesuai</button></div>' : '') + '</div>' +
        (b.status === 'Tidak Sesuai' && b.catatan ? '<div class="banner err" style="margin-top:8px">' + ic('error') + '<div class="small"><b>Catatan:</b> ' + esc(b.catatan) + '</div></div>' : '') +
        '<div data-note hidden style="margin-top:8px"><textarea class="input" placeholder="Alasan berkas tidak sesuai (wajib)" maxlength="300"></textarea><div class="row" style="margin-top:6px;justify-content:flex-end"><button class="btn btn-o btn-s" data-act="batalNote">Batal</button><button class="btn btn-d btn-s" data-act="simpanNote" data-j="' + esc(j) + '">Simpan</button></div></div></div>';
    }).join('');
    var siap = selesaiSemua(d), adaSalah = d.berkas.some(function (b) { return b.status === 'Tidak Sesuai'; });
    var aksi = '';
    if (editable) {
      aksi = '<div class="card gold stack-s"><b>Tindakan</b>' +
        '<div class="row wrap-r"><button class="btn btn-o ' + (adaSalah ? '' : 'off') + '" data-act="perbaikan">' + ic('edit_note') + 'Minta Perbaikan</button>' +
        '<label class="btn btn-ok ' + (siap ? '' : 'off') + '" style="cursor:pointer">' + ic('upload_file') + 'Unggah Dokumen Legalisasi<input type="file" hidden data-legal accept=".pdf,.jpg,.jpeg,.png"></label></div>' +
        '<p class="small muted">' + (siap ? 'Semua berkas sudah berstatus Sesuai. Dokumen legalisasi dapat diunggah.' : adaSalah ? 'Ada berkas Tidak Sesuai: kirim permintaan perbaikan ke pemohon.' : 'Tandai setiap berkas Sesuai atau Tidak Sesuai. Unggah legalisasi aktif setelah semuanya Sesuai.') + '</p></div>';
    } else if (d.status === 'Terlegalisasi') {
      aksi = '<div class="card gold stack-s"><div class="row"><span class="ico" style="background:var(--ok-bg);color:var(--ok)">' + ic('verified', 'fill') + '</span><b>Dokumen sudah dilegalisasi</b></div><label class="btn btn-o btn-s" style="cursor:pointer;align-self:flex-start">' + ic('sync') + 'Ganti dokumen legalisasi<input type="file" hidden data-legal accept=".pdf,.jpg,.jpeg,.png"></label></div>';
    } else {
      aksi = '<div class="banner info">' + ic('hourglass_empty') + '<div class="small">Pendaftaran ini belum siap diverifikasi (status: ' + esc(d.status) + '). Menunggu pemohon melengkapi berkas atau pembayaran.' + (d.status === 'Perlu Perbaikan' ? ' Catatan: ' + esc(d.catatanPetugas || '-') : '') + '</div></div>';
    }
    var riw = d.riwayat.length ? d.riwayat.map(function (x) { return '<li class="done"><i>' + ic('check') + '</i><div class="small"><b>' + esc(x.aksi) + '</b> &middot; ' + esc(x.oleh) + '<div class="tiny muted">' + UI.tgl(x.waktu, true) + (x.ket ? ' &middot; ' + esc(x.ket) : '') + '</div></div></li>'; }).join('') : '<p class="muted small">Belum ada riwayat.</p>';
    var info = function (l, v) { return '<div><div class="tiny muted">' + l + '</div><b class="small" style="word-break:break-word">' + (esc(v) || '-') + '</b></div>'; };
    $('#v').innerHTML = '<div class="stack"><a class="btn btn-t btn-s" href="' + (O.mode === 'antrean' ? '#/antrean' : '#/') + '" style="align-self:flex-start">' + ic('arrow_back') + 'Kembali ke daftar</a>' +
      '<div class="card gold"><div class="row between wrap-r"><div><div class="tiny muted">ID Registrasi</div><div class="big-id" style="font-size:24px">' + esc(d.id) + '</div></div>' + UI.status(d.status) + '</div>' +
      '<div class="grid g3" style="margin-top:14px;gap:10px">' + info('Pemohon', d.pemohon) + info('Penerima kuasa / instansi', d.penerima) + info('Kelompok', d.kelompok) + info('Kontak', d.kontak) + info('Email', d.email) + info('Tanggal daftar', UI.tgl(d.tanggal, true)) + '</div></div>' +
      '<div class="split"><div class="card" style="position:sticky;top:76px"><div class="row between" style="margin-bottom:10px"><b id="vtitle">Pratinjau berkas</b><a id="vopen" class="btn btn-o btn-s" target="_blank" rel="noopener" hidden>' + ic('open_in_new') + 'Buka</a></div><div class="viewer" id="viewer"><div class="empty" style="padding:24px">' + ic('description') + '<span class="small">Pilih &ldquo;Lihat&rdquo; pada sebuah berkas</span></div></div></div>' +
      '<div class="stack"><div class="card"><b style="display:block;margin-bottom:10px">Berkas &amp; Verifikasi</b>' + daftar + '</div>' + aksi +
      '<div class="card"><b style="display:block;margin-bottom:10px">Riwayat</b><ul class="tl">' + riw + '</ul></div></div></div></div>';
  }

  async function lihat(id, jenis, senyap) {
    var box = $('#viewer'); if (!box) return;
    var k = id + '|' + jenis;
    box.innerHTML = '<div class="sk" style="width:100%;height:320px"></div>';
    try {
      var p = O.prev[k];
      if (!p) { var r = await api('off.preview', { id: id, jenis: jenis }, { timeout: 90000 }); p = { url: UI.blobUrl(r.b64, r.mime), mime: r.mime, nama: r.nama }; O.prev[k] = p; }
      if (!O.cur || O.cur.id !== id || !$('#viewer')) return;
      $('#viewer').innerHTML = p.mime === 'application/pdf' ? '<iframe src="' + p.url + '" title="' + esc(jenis) + '"></iframe>' : '<img src="' + p.url + '" alt="' + esc(jenis) + '">';
      $('#vtitle').textContent = jenis;
      var o = $('#vopen'); o.href = p.url; o.hidden = false;
      if (!senyap && window.innerWidth < 1100) $('#viewer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { if ($('#viewer')) $('#viewer').innerHTML = '<div class="banner err" style="margin:12px">' + ic('error') + '<div class="small">' + esc(e.message) + '</div></div>'; }
  }

  async function verif(jenis, hasil, catatan) {
    var d = O.cur, b = d.berkas.filter(function (x) { return x.jenis === jenis; })[0];
    if (!b) return;
    var lama = { s: b.status, c: b.catatan };
    b.status = hasil; b.catatan = hasil === 'Sesuai' ? '' : catatan; renderDetail();   // optimistis
    delete O.det[d.id];
    try {
      await api('off.verifBerkas', { id: d.id, jenis: jenis, hasil: hasil, catatan: catatan || '' });
      O.v = ''; muatList();
    } catch (e) { b.status = lama.s; b.catatan = lama.c; renderDetail(); UI.toast(e.message, 'err'); }
  }

  function promptCatatan() {
    return new Promise(function (res) {
      var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      m.innerHTML = '<div class="sheet"><h3>Minta perbaikan berkas</h3><p class="muted small" style="margin:6px 0 10px">Catatan akan dikirim ke pemohon lewat email dan tampil di halaman Cek Status. Kosongkan untuk memakai catatan per berkas.</p><textarea class="input" maxlength="500" placeholder="Catatan tambahan (opsional)"></textarea><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-o" data-n>Batal</button><button class="btn btn-p" data-y>Kirim permintaan</button></div></div>';
      document.body.appendChild(m);
      var ta = m.querySelector('textarea'); ta.focus();
      m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-n')) { m.remove(); res(null); } else if (e.target.hasAttribute('data-y')) { var v = ta.value; m.remove(); res(v); } });
    });
  }

  async function uploadLegal(inp) {
    var file = inp.files[0]; inp.value = '';
    if (!file || !O.cur) return;
    var d = O.cur;
    if (!await UI.confirm('Unggah dokumen legalisasi?', 'Pendaftaran ' + d.id + ' akan ditandai Terlegalisasi dan pemohon diberi tahu lewat email.', 'Unggah & legalisasi')) return;
    var btn = inp.closest('label'); if (btn) btn.classList.add('off');
    UI.toast('Mengunggah dokumen...', '');
    try {
      var b = await UI.siapkanBerkas(file, 5 * 1024 * 1024);
      await api('off.legalisasi', { id: d.id, nama: b.nama, b64: b.b64 }, { timeout: 120000 });
      UI.toast('Dokumen terlegalisasi. Pemohon akan menerima email.', 'ok');
      delete O.det[d.id]; O.v = ''; muatList(); vDetail(d.id);
    } catch (e) { UI.toast(e.message, 'err'); if (btn) btn.classList.remove('off'); }
  }

  // ============================================================
  // LAPORAN
  // ============================================================
  function vLaporan() {
    O.lg = O.lg || {};
    var l = O.lg;
    $('#v').innerHTML = '<div class="stack"><div class="card filters" style="grid-template-columns:1fr"><div class="grid g3" style="gap:8px"><label class="field"><span class="small">Dari tanggal</span><input class="input" type="date" id="lgDari" value="' + esc(l.lgDari || '') + '"></label><label class="field"><span class="small">Sampai tanggal</span><input class="input" type="date" id="lgSampai" value="' + esc(l.lgSampai || '') + '"></label>' +
      '<label class="field"><span class="small">Kelompok</span><select class="input" id="lgKel"><option value="">Semua</option>' + Object.keys(KELOMPOK).map(function (k) { return '<option value="' + k + '" ' + (l.lgKel === k ? 'selected' : '') + '>' + k + ' (' + KELOMPOK[k] + ')</option>'; }).join('') + '</select></label></div></div>' +
      '<div id="lap"></div></div>';
    renderLaporan();
  }
  function renderLaporan() {
    var el = $('#lap'); if (!el) return;
    if (!O.loaded) { el.innerHTML = '<div class="card"><div class="sk" style="height:200px"></div></div>'; return; }
    var l = O.lg || {};
    var r = O.rows.filter(function (x) {
      if (l.lgKel && x.k !== l.lgKel) return false;
      if (l.lgDari || l.lgSampai) { var d = tgl(x.t); if ((l.lgDari && d < l.lgDari) || (l.lgSampai && d > l.lgSampai)) return false; }
      return true;
    });
    var perKel = {}, perSt = {}, mat = {};
    Object.keys(KELOMPOK).forEach(function (k) { perKel[k] = 0; mat[k] = {}; });
    STATUSES.forEach(function (s) { perSt[s] = 0; });
    r.forEach(function (x) { perKel[x.k] = (perKel[x.k] || 0) + 1; perSt[x.s] = (perSt[x.s] || 0) + 1; if (!mat[x.k]) mat[x.k] = {}; mat[x.k][x.s] = (mat[x.k][x.s] || 0) + 1; });
    var maks = Math.max(1, r.length);
    var bars = function (obj, lab, g) { return Object.keys(obj).map(function (k) { return '<div class="hbar ' + (g ? 'g' : '') + '"><span>' + esc(lab ? lab(k) : k) + '</span><div class="tr"><i style="width:' + Math.round(obj[k] / maks * 100) + '%"></i></div><b>' + obj[k] + '</b></div>'; }).join(''); };
    var tbl = Object.keys(mat).map(function (k) {
      var tot = 0; var tds = STATUSES.map(function (s) { var n = (mat[k] || {})[s] || 0; tot += n; return '<td data-l="' + s + '">' + n + '</td>'; }).join('');
      return '<tr><td data-l="Kelompok"><b>' + k + '</b> <span class="muted small">' + KELOMPOK[k] + '</span></td>' + tds + '<td data-l="Total"><b>' + tot + '</b></td></tr>';
    }).join('');
    el.innerHTML = '<div class="stack"><div class="grid g4"><div class="card kpi"><div class="l">Total pada periode</div><div class="v">' + r.length + '</div></div><div class="card kpi ok"><div class="l">Terlegalisasi</div><div class="v">' + perSt['Terlegalisasi'] + '</div></div><div class="card kpi warn"><div class="l">Menunggu Verifikasi</div><div class="v">' + perSt['Menunggu Verifikasi'] + '</div></div><div class="card kpi err"><div class="l">Perlu Perbaikan</div><div class="v">' + perSt['Perlu Perbaikan'] + '</div></div></div>' +
      '<div class="grid g2"><div class="card"><b style="display:block;margin-bottom:8px">Pendaftaran per kelompok</b>' + bars(perKel, function (k) { return k + ' ' + KELOMPOK[k]; }, true) + '</div><div class="card"><b style="display:block;margin-bottom:8px">Pendaftaran per status</b>' + bars(perSt) + '</div></div>' +
      '<div class="tbl-wrap"><div class="tbl-scroll"><table class="t stack"><thead><tr><th>Kelompok</th>' + STATUSES.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' + tbl + '</tbody></table></div></div>' +
      '<div class="card row wrap-r"><div class="grow"><b>Ekspor Buku Register</b><div class="small muted">Sesuai rentang tanggal di atas (semua kelompok). Maksimal 5.000 baris.</div></div><button class="btn btn-o" data-act="ekspor" data-f="xlsx">' + ic('table_view') + 'Excel (.xlsx)</button><button class="btn btn-p" data-act="ekspor" data-f="pdf">' + ic('picture_as_pdf') + 'PDF</button></div></div>';
  }

  // ============================================================
  // ADMIN
  // ============================================================
  var SET_LAB = [['NAMA_INSTANSI', 'Nama instansi'], ['NAMA_LAYANAN', 'Nama layanan'], ['NOMINAL_PNBP', 'Nominal PNBP (Rp)'], ['BANK_NAMA', 'Nama bank'], ['BANK_NOREK', 'Nomor rekening'], ['BANK_ATAS_NAMA', 'Atas nama rekening'], ['CATATAN_PENTING', 'Catatan penting (beranda)'], ['KONTAK_ALAMAT', 'Alamat'], ['KONTAK_TELEPON', 'Telepon'], ['KONTAK_EMAIL', 'Email kontak'], ['JAM_LAYANAN', 'Jam layanan'], ['URL_PORTAL', 'URL portal pemohon (untuk tautan di email)'], ['EMAIL_AKTIF', 'Kirim email notifikasi (Ya/Tidak)']];
  function vAdmin() {
    var tabs = [['petugas', 'Petugas'], ['tema', 'Tema Warna'], ['logo', 'Logo'], ['wa', 'Notifikasi WA'], ['log', 'Log Aktivitas'], ['setelan', 'Pengaturan']];
    kembalikanTema(); kembalikanLogo();
    $('#v').innerHTML = '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" class="' + (O.tab === t[0] ? 'on' : '') + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="adm"></div>';
    muatTab();
  }
  async function muatTab() {
    var el = $('#adm'); if (!el) return;
    el.innerHTML = '<div class="card"><div class="sk" style="height:140px"></div></div>';
    var tab = O.tab;
    try {
      if (tab === 'petugas') {
        var r = await api('adm.petugas');
        if (O.tab !== tab || !$('#adm')) return;
        el.innerHTML = '<div class="stack"><div class="row between"><p class="muted small">Petugas aktif dapat masuk dengan akun Google (email) atau username &amp; sandi.</p><button class="btn btn-p btn-s" data-act="petugasBaru">' + ic('person_add') + 'Tambah Petugas</button></div><div class="tbl-wrap"><div class="tbl-scroll"><table class="t stack"><thead><tr><th>Email</th><th>Nama</th><th>Username</th><th>Peran</th><th>Aktif</th><th></th></tr></thead><tbody>' +
          r.rows.map(function (p) { return '<tr><td data-l="Email">' + esc(p.email) + '</td><td data-l="Nama">' + esc(p.nama) + '</td><td data-l="Username">' + (p.username ? '<span class="chip">' + esc(p.username) + '</span>' : '<span class="muted small">Google saja</span>') + '</td><td data-l="Peran"><span class="pill ' + (p.peran === 'Admin' ? 'gold' : '') + '">' + esc(p.peran) + '</span></td><td data-l="Aktif">' + (p.aktif === 'Ya' ? '<span class="pill ok">Aktif</span>' : '<span class="pill gray">Nonaktif</span>') + '</td><td data-l="Aksi" style="text-align:right"><button class="btn btn-o btn-s" data-act="petugasUbah" data-e="' + esc(p.email) + '" data-n="' + esc(p.nama) + '" data-p="' + esc(p.peran) + '" data-a="' + esc(p.aktif) + '" data-u="' + esc(p.username || '') + '">Ubah</button></td></tr>'; }).join('') + '</tbody></table></div></div></div>';
      } else if (tab === 'tema') {
        var st = await api('adm.setelan');
        if (O.tab !== tab || !$('#adm')) return;
        var c = st.setelan || {};
        O.temaAsli = { k: c.TEMA || 'navy-emas', p: c.TEMA_PRIMER || '', a: c.TEMA_AKSEN || '' };
        O.temaPilih = Object.assign({}, O.temaAsli);
        renderTema();
      } else if (tab === 'logo') {
        var sl = await api('adm.setelan');
        if (O.tab !== tab || !$('#adm')) return;
        var cl = sl.setelan || {};
        O.logoAsli = { b: cl.LOGO_BENTUK || 'lencana', i: cl.LOGO_IKON || 'gavel', g: cl.LOGO_GAMBAR || '' };
        O.logoPilih = Object.assign({}, O.logoAsli);
        renderLogo();
      } else if (tab === 'wa') {
        var w = await api('adm.waStatus'), q = await api('adm.waAntrean');
        if (O.tab !== tab || !$('#adm')) return;
        renderWa(w, q.rows);
      } else if (tab === 'log') {
        var l = await api('adm.log', { batas: 200 });
        if (O.tab !== tab || !$('#adm')) return;
        el.innerHTML = l.rows.length ? '<div class="tbl-wrap"><div class="tbl-scroll"><table class="t stack"><thead><tr><th>Waktu</th><th>Oleh</th><th>ID</th><th>Aksi</th><th>Keterangan</th></tr></thead><tbody>' +
          l.rows.map(function (x) { return '<tr><td data-l="Waktu" class="small muted">' + UI.tgl(x.waktu, true) + '</td><td data-l="Oleh" class="small">' + esc(x.oleh) + '</td><td data-l="ID" class="small">' + esc(x.id) + '</td><td data-l="Aksi"><span class="chip">' + esc(x.aksi) + '</span></td><td data-l="Ket" class="small muted">' + esc(x.ket) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '<div class="empty">' + ic('history') + 'Belum ada aktivitas.</div>';
      } else {
        var s = await api('adm.setelan');
        if (O.tab !== tab || !$('#adm')) return;
        el.innerHTML = '<form class="card stack" data-form="setelan"><div class="grid g2">' + SET_LAB.map(function (x) {
          var v = s.setelan[x[0]] || '', panjang = x[0] === 'CATATAN_PENTING' || x[0] === 'KONTAK_ALAMAT';
          return '<label class="field" ' + (panjang ? 'style="grid-column:1/-1"' : '') + '><span>' + x[1] + '</span>' + (panjang ? '<textarea class="input" name="' + x[0] + '" maxlength="400">' + esc(v) + '</textarea>' : '<input class="input" name="' + x[0] + '" value="' + esc(v) + '" maxlength="400">') + '</label>';
        }).join('') + '</div><div class="row" style="justify-content:flex-end"><button class="btn btn-p">' + ic('save') + 'Simpan Pengaturan</button></div></form>';
      }
    } catch (e) { if ($('#adm')) $('#adm').innerHTML = '<div class="banner err">' + ic('error') + '<div>' + esc(e.message) + '</div></div>'; }
  }

  // ---------- Notifikasi WhatsApp (Fonnte) ----------
  function renderWa(w, rows) {
    var el = $('#adm'); if (!el) return;
    var kej = w.kejadian.map(function (k) {
      return '<tr><td data-l="Kejadian">' + esc(k.label) + '</td><td data-l="Kirim WA"><select class="input" name="' + esc(k.kunci) + '" aria-label="' + esc(k.label) + '"><option value="Ya"' + (k.aktif ? ' selected' : '') + '>Ya</option><option value="Tidak"' + (k.aktif ? '' : ' selected') + '>Tidak</option></select></td></tr>';
    }).join('');
    var warna = function (s) { return s === 'Terkirim' ? 'ok' : s === 'Gagal' ? 'err' : 'gray'; };
    var baris = rows.length ? rows.map(function (x) {
      return '<tr><td data-l="Waktu" class="small muted">' + UI.tgl(x.waktu, true) + '</td><td data-l="Tujuan" class="small">' + esc(x.tujuan) + '</td><td data-l="Nama" class="small">' + esc(x.nama) + '</td><td data-l="Kejadian"><span class="chip">' + esc(x.event) + '</span></td><td data-l="ID" class="small">' + esc(x.ref) + '</td><td data-l="Status"><span class="pill ' + warna(x.status) + '">' + esc(x.status) + '</span></td><td data-l="Respon" class="small muted">' + esc(x.respon) + '</td></tr>';
    }).join('') : '';
    el.innerHTML = '<div class="stack">' +
      '<div class="grid g4"><div class="card kpi ' + (w.aktif && w.tokenAda ? 'ok' : 'warn') + '"><div class="l">Status</div><div class="v" style="font-size:20px">' + (w.aktif ? (w.tokenAda ? 'Aktif' : 'Belum ada token') : 'Nonaktif') + '</div></div>' +
      '<div class="card kpi"><div class="l">Antri</div><div class="v">' + w.antri + '</div></div><div class="card kpi ok"><div class="l">Terkirim</div><div class="v">' + w.terkirim + '</div></div><div class="card kpi err"><div class="l">Gagal</div><div class="v">' + w.gagal + '</div></div></div>' +
      '<div class="card stack-s"><b>Token Fonnte</b><p class="small muted">Token disimpan di Script Properties server, tidak pernah ditampilkan utuh. ' + (w.tokenAda ? 'Tersimpan: <span class="mono">' + esc(w.tokenSamar) + '</span>' : 'Belum ada token tersimpan.') + '</p>' +
      '<form data-form="waToken" class="row wrap-r"><input class="input grow" type="password" name="token" autocomplete="off" placeholder="' + (w.tokenAda ? 'Kosongkan bila tidak diubah' : 'Tempel token dari fonnte.com') + '" style="min-width:220px"><button class="btn btn-p">' + ic('save') + 'Simpan token</button>' + (w.tokenAda ? '<button type="button" class="btn btn-o" data-act="waHapusToken">Hapus token</button>' : '') + '</form></div>' +
      '<form class="card stack-s" data-form="waSaklar"><b>Saklar notifikasi</b><label class="field"><span>Kirim notifikasi WhatsApp ke pemohon</span><select class="input" name="WA_AKTIF"><option value="Ya"' + (w.aktif ? ' selected' : '') + '>Ya, aktif</option><option value="Tidak"' + (w.aktif ? '' : ' selected') + '>Tidak, nonaktif</option></select></label>' +
      '<div class="tbl-wrap"><div class="tbl-scroll"><table class="t stack"><thead><tr><th>Kejadian</th><th>Kirim WA</th></tr></thead><tbody>' + kej + '</tbody></table></div></div>' +
      '<p class="small muted">Hanya nomor seluler Indonesia (08xx / +628xx) yang dikirimi. Kode Akses tidak dikirim lewat WhatsApp.</p><div class="row" style="justify-content:flex-end"><button class="btn btn-p">' + ic('save') + 'Simpan saklar</button></div></form>' +
      '<form class="card stack-s" data-form="waTes"><b>Tes kirim</b><div class="row wrap-r"><input class="input grow" name="hp" inputmode="tel" placeholder="Nomor WhatsApp, mis. 0812xxxxxxxx" style="min-width:220px"><button class="btn btn-o">' + ic('send') + 'Kirim tes</button></div></form>' +
      '<div class="row between wrap-r"><b>Antrean terakhir</b><div class="row"><button class="btn btn-o btn-s" data-act="waUlang">' + ic('replay') + 'Kirim ulang yang gagal</button><button class="btn btn-t btn-s" data-act="waMuat">' + ic('refresh') + 'Muat ulang</button></div></div>' +
      (rows.length ? '<div class="tbl-wrap"><div class="tbl-scroll"><table class="t stack"><thead><tr><th>Waktu</th><th>Tujuan</th><th>Nama</th><th>Kejadian</th><th>ID</th><th>Status</th><th>Respon</th></tr></thead><tbody>' + baris + '</tbody></table></div></div>' : '<div class="empty">' + ic('chat') + 'Belum ada pesan WhatsApp.</div>') +
      '</div>';
  }


  // ---------- Logo ----------
  function kembalikanLogo() {
    if (O.logoAsli && O.logoPilih && JSON.stringify(O.logoAsli) !== JSON.stringify(O.logoPilih)) Tema.pasangLogo(O.logoAsli.b, O.logoAsli.i, O.logoAsli.g);
    O.logoPilih = O.logoAsli ? Object.assign({}, O.logoAsli) : null;
  }
  function markLogo(b, i, g) {   // contoh logo mandiri (tidak ikut diubah otomatis)
    return '<span class="brand-mark' + (g ? ' pakai-gambar' : '') + '" data-bentuk="' + b + '" data-contoh>' + (g ? '<img src="' + g + '" alt="">' : '<span class="ms fill">' + i + '</span>') + '</span>';
  }
  function renderLogo() {
    var el = $('#adm'); if (!el || !O.logoPilih) return;
    var L = O.logoPilih, nama = esc((O.boot && O.boot.cfg && O.boot.cfg.NAMA_INSTANSI) || 'Pengadilan Tata Usaha Negara');
    var ubah = JSON.stringify(O.logoAsli) !== JSON.stringify(L);
    var bentuk = Object.keys(Tema.bentuk).map(function (k) {
      var on = L.b === k;
      return '<button type="button" class="pil' + (on ? ' on' : '') + '" data-act="logoBentuk" data-k="' + k + '" aria-pressed="' + on + '">' + markLogo(k, L.i, L.g) + '<b>' + esc(Tema.bentuk[k].nama) + '</b><small>' + esc(Tema.bentuk[k].ket) + '</small></button>';
    }).join('');
    var ikon = Object.keys(Tema.ikon).map(function (k) {
      var on = !L.g && L.i === k;
      return '<button type="button" class="pil' + (on ? ' on' : '') + '" data-act="logoIkon" data-k="' + k + '" aria-pressed="' + on + '"><span class="ms fill">' + k + '</span><small>' + esc(Tema.ikon[k]) + '</small></button>';
    }).join('');
    el.innerHTML = '<div class="stack">' +
      '<div class="card stack-s"><b>Pratinjau</b><div class="logo-pv">' +
        '<div class="terang">' + markLogo(L.b, L.i, L.g) + '<div style="min-width:0"><b>' + nama + '</b><span class="t">E-KUASA</span></div></div>' +
        '<div class="gelap">' + markLogo(L.b, L.i, L.g) + '<div style="min-width:0"><b>E-Kuasa</b><span class="t">DASHBOARD PETUGAS</span></div></div></div>' +
        '<p class="small muted">Logo dipakai di header portal pemohon, sidebar dashboard, halaman login, dan ikon tab browser (bila memakai gambar).</p></div>' +
      '<div class="card stack-s"><b>Bentuk logo</b><div class="pil-grid">' + bentuk + '</div></div>' +
      '<div class="card stack-s"><b>Isi logo</b>' +
        '<div class="unggah-logo"><span class="kotak-img">' + (L.g ? '<img src="' + L.g + '" alt="Logo unggahan">' : ic('add_photo_alternate')) + '</span>' +
        '<div class="stack-s" style="flex:1;min-width:200px"><span class="small"><b>Gambar logo instansi</b> (PNG/JPG/WebP). Disarankan persegi dengan latar transparan. Gambar diperkecil otomatis.</span>' +
        '<div class="row wrap-r"><label class="btn btn-o btn-s" style="cursor:pointer">' + ic('upload') + (L.g ? 'Ganti gambar' : 'Unggah gambar') + '<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-logo-file></label>' +
        (L.g ? '<button type="button" class="btn btn-t btn-s" data-act="logoHapusGambar">' + ic('delete') + 'Pakai ikon saja</button>' : '') + '</div></div></div>' +
        '<span class="small muted">' + (L.g ? 'Ikon di bawah dipakai kembali bila gambar dihapus.' : 'Atau pilih ikon bawaan:') + '</span><div class="ikon-grid">' + ikon + '</div></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-o ' + (ubah ? '' : 'off') + '" data-act="logoBatal">Batal</button><button type="button" class="btn btn-p ' + (ubah ? '' : 'off') + '" data-act="logoSimpan">' + ic('save') + 'Simpan Logo</button></div></div>';
  }
  function pratinjauLogo() { var L = O.logoPilih; Tema.pasangLogo(L.b, L.i, L.g); renderLogo(); }
  // Perkecil gambar ke maks 192px; PNG dulu, WebP bila masih terlalu besar
  function kecilkanLogo(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('Gunakan gambar PNG, JPG, atau WebP.'));
      if (file.size > 8 * 1024 * 1024) return rej(new Error('Gambar terlalu besar (maks 8 MB).'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 192 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        var hasil = cv.toDataURL('image/png');
        [0.9, 0.8, 0.65].forEach(function (q) { if (hasil.length > 58000) { var wbp = cv.toDataURL('image/webp', q); if (/^data:image\/webp/.test(wbp)) hasil = wbp; } });
        if (hasil.length > 58000) return rej(new Error('Gambar terlalu rumit untuk dijadikan logo. Coba gambar yang lebih sederhana.'));
        res(hasil);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca.')); };
      img.src = url;
    });
  }

  // ---------- Tema warna ----------
  function kembalikanTema() {   // keluar dari tab tanpa menyimpan: pulihkan tema tersimpan
    if (O.temaAsli && O.temaPilih && JSON.stringify(O.temaAsli) !== JSON.stringify(O.temaPilih)) Tema.pasang(O.temaAsli.k, O.temaAsli.p, O.temaAsli.a);
    O.temaPilih = O.temaAsli ? Object.assign({}, O.temaAsli) : null;
  }
  function kartuTema(kode, nama, ket, p, a) {
    var w = Tema.turunan(p, a), on = O.temaPilih.k === kode;
    return '<button type="button" class="tema' + (on ? ' on' : '') + '" data-act="temaPilih" data-k="' + kode + '" aria-pressed="' + on + '">' +
      '<span class="pv" aria-hidden="true"><i style="background:' + w['--navy'] + ';border-right:3px solid ' + w['--gold'] + '"></i><span class="r"><b style="background:' + w['--navy'] + ';width:70%"></b><b style="background:' + w['--navy-m'] + '"></b><span style="background:' + w['--gold'] + '"></span></span></span>' +
      '<span class="nm">' + esc(nama) + '<span class="dots"><i style="background:' + w['--navy'] + '"></i><i style="background:' + w['--gold'] + '"></i><i style="background:' + w['--gold-l'] + '"></i></span></span>' +
      '<small>' + esc(ket) + '</small>' + (on ? '<span class="pill gold" style="justify-self:start">' + ic('check', 'fill') + 'Dipilih</span>' : '') + '</button>';
  }
  function renderTema() {
    var el = $('#adm'); if (!el || !O.temaPilih) return;
    var t = O.temaPilih, D = Tema.daftar;
    var kartu = Object.keys(D).map(function (k) { return kartuTema(k, D[k].nama, D[k].ket, D[k].p, D[k].a); }).join('');
    var kp = Tema.valid(t.p) ? t.p : '#0B2545', ka = Tema.valid(t.a) ? t.a : '#C9A227';
    kartu += kartuTema('kustom', 'Kustom', 'Pilih sendiri warna utama dan aksen di bawah.', kp, ka);
    var ubah = JSON.stringify(O.temaAsli) !== JSON.stringify(t);
    el.innerHTML = '<div class="stack">' +
      '<div class="banner info">' + ic('palette') + '<div class="small">Klik sebuah tema untuk melihat pratinjau langsung di halaman ini. Tema baru berlaku untuk <b>portal pemohon dan dashboard petugas</b> setelah <b>Simpan</b>.</div></div>' +
      '<div class="tema-grid">' + kartu + '</div>' +
      (t.k === 'kustom' ? '<div class="card stack-s"><b>Warna kustom</b><div class="kustom">' +
        '<label class="field"><span>Warna utama (gelap)</span><div class="row"><input type="color" id="tmP" value="' + kp + '"><input class="input" id="tmPh" value="' + kp + '" maxlength="7" style="max-width:120px"></div></label>' +
        '<label class="field"><span>Warna aksen (emas)</span><div class="row"><input type="color" id="tmA" value="' + ka + '"><input class="input" id="tmAh" value="' + ka + '" maxlength="7" style="max-width:120px"></div></label></div>' +
        '<p class="small muted">Warna utama yang terlalu terang otomatis digelapkan agar teks tetap mudah dibaca.</p></div>' : '') +
      '<div class="card"><b style="display:block;margin-bottom:10px">Pratinjau komponen</b><div class="row wrap-r"><button type="button" class="btn btn-p">' + ic('send') + 'Tombol utama</button><button type="button" class="btn btn-g">' + ic('star') + 'Tombol emas</button><button type="button" class="btn btn-o">Tombol garis</button>' +
        UI.status('Menunggu Verifikasi') + UI.status('Terlegalisasi') + '<span class="pill gold">Aksen emas</span><span class="chip">ADV</span></div></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-o ' + (ubah ? '' : 'off') + '" data-act="temaBatal">Batal</button><button type="button" class="btn btn-p ' + (ubah ? '' : 'off') + '" data-act="temaSimpan">' + ic('save') + 'Simpan Tema</button></div></div>';
  }
  function pratinjauTema() { var t = O.temaPilih; Tema.pasang(t.k, t.p, t.a); renderTema(); }

  function sandiAcak() {
    var h = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', n = '23456789', s = '', a = new Uint32Array(12);
    crypto.getRandomValues(a);
    for (var i = 0; i < 12; i++) s += (i % 4 === 3 ? n : h)[a[i] % (i % 4 === 3 ? n.length : h.length)];
    return s;
  }
  function kolomSandi(nama, label, ph, acak, ac) {
    return '<label class="field"><span>' + label + '</span><span class="pw-wrap"><input class="input" type="password" name="' + nama + '" autocomplete="' + (ac || 'new-password') + '" placeholder="' + esc(ph) + '" maxlength="100">' +
      '<button type="button" class="pw-eye" data-pw aria-label="Tampilkan sandi">' + ic('visibility') + '</button></span>' +
      (acak ? '<span class="row" style="justify-content:space-between;margin-top:4px"><small class="muted">Min. 8 karakter, huruf &amp; angka.</small><button type="button" class="btn btn-t btn-s" data-acak>' + ic('casino') + 'Buat acak</button></span>' : '') + '</label>';
  }
  function pasangMata(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pw]');
      if (b) { var inp = b.parentNode.querySelector('input'), l = inp.type === 'password'; inp.type = l ? 'text' : 'password'; b.innerHTML = ic(l ? 'visibility_off' : 'visibility'); b.setAttribute('aria-label', l ? 'Sembunyikan sandi' : 'Tampilkan sandi'); return; }
      var g = e.target.closest('[data-acak]');
      if (g) { var s = g.closest('form').sandi; s.value = sandiAcak(); s.type = 'text'; s.parentNode.querySelector('[data-pw]').innerHTML = ic('visibility_off'); s.select(); UI.toast('Sandi acak dibuat. Catat dan berikan ke petugas.', ''); }
    });
  }
  function modalPetugas(p) {
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    var unAda = p && p.u;
    m.innerHTML = '<form class="sheet stack" autocomplete="off"><h3>' + (p ? 'Ubah petugas' : 'Tambah petugas') + '</h3>' +
      '<label class="field"><span>Email</span><input class="input" type="email" name="email" value="' + esc(p ? p.e : '') + '" ' + (p ? 'readonly' : '') + ' required placeholder="nama@contoh.go.id"><small class="muted">Dipakai untuk login Google dan sebagai identitas petugas.</small></label>' +
      '<label class="field"><span>Nama</span><input class="input" name="nama" value="' + esc(p ? p.n : '') + '" maxlength="100"></label>' +
      '<div class="grid g2" style="gap:12px"><label class="field"><span>Peran</span><select class="input" name="peran"><option ' + (p && p.p === 'Petugas' ? 'selected' : '') + '>Petugas</option><option ' + (p && p.p === 'Admin' ? 'selected' : '') + '>Admin</option></select></label>' +
      '<label class="field"><span>Status</span><select class="input" name="aktif"><option value="Ya" ' + (!p || p.a === 'Ya' ? 'selected' : '') + '>Aktif</option><option value="Tidak" ' + (p && p.a === 'Tidak' ? 'selected' : '') + '>Nonaktif</option></select></label></div>' +
      '<div class="akun-box"><b class="small">Login dengan username &amp; sandi</b><span class="tiny muted">Opsional. Kosongkan username bila petugas hanya masuk dengan Google.' + (unAda ? ' Hapus username untuk mencabut login sandi.' : '') + '</span>' +
      '<div class="grid g2" style="gap:12px"><label class="field"><span>Username</span><input class="input" name="username" value="' + esc(unAda || '') + '" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="30" placeholder="mis. budi.s"></label>' +
      kolomSandi('sandi', unAda ? 'Sandi baru' : 'Sandi', unAda ? 'Kosongkan bila tidak diubah' : 'Minimal 8 karakter', true) + '</div></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-o" data-n>Batal</button><button class="btn btn-p">Simpan</button></div></form>';
    document.body.appendChild(m);
    pasangMata(m);
    var f = m.querySelector('form');
    f.username.addEventListener('input', function () { var v = f.username.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); if (v !== f.username.value) f.username.value = v; });
    m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-n')) m.remove(); });
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = f.querySelector('.btn-p'), un = f.username.value.trim(), sd = f.sandi.value;
      if (un && !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(un)) { UI.toast('Username 3-30 karakter: huruf kecil, angka, titik, _ atau -.', 'warn'); f.username.focus(); return; }
      if (un && un !== unAda && !unAda && !sd) { UI.toast('Isi sandi untuk username baru.', 'warn'); f.sandi.focus(); return; }
      if (sd && (sd.length < 8 || !/[A-Za-z]/.test(sd) || !/\d/.test(sd))) { UI.toast('Sandi minimal 8 karakter dan berisi huruf serta angka.', 'warn'); f.sandi.focus(); return; }
      if (unAda && !un && !await UI.confirm('Cabut login sandi?', 'Petugas ini tidak bisa lagi masuk dengan username & sandi.', 'Cabut', true)) return;
      UI.busy(btn, true);
      try {
        await api('adm.petugasSimpan', { email: f.email.value, nama: f.nama.value, peran: f.peran.value, aktif: f.aktif.value, username: un, sandi: sd });
        m.remove(); try { localStorage.removeItem('ek:boot'); } catch (x) { /* abaikan */ }
        UI.toast(sd ? 'Petugas tersimpan. Berikan username & sandi kepada petugas secara langsung.' : 'Petugas tersimpan.', 'ok'); muatTab();
      } catch (err) { UI.toast(err.message, 'err'); UI.busy(btn, false); }
    });
  }
  function modalGantiSandi() {
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<form class="sheet stack" autocomplete="off"><h3>Ganti sandi</h3><p class="small muted">Username: <b>' + esc(O.user.username) + '</b></p>' +
      kolomSandi('lama', 'Sandi lama', '', false, 'current-password') + kolomSandi('baru', 'Sandi baru', 'Minimal 8 karakter, huruf & angka', false) + kolomSandi('ulang', 'Ulangi sandi baru', '', false) +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-o" data-n>Batal</button><button class="btn btn-p">Simpan sandi</button></div></form>';
    document.body.appendChild(m); pasangMata(m);
    var f = m.querySelector('form'); f.lama.focus();
    m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-n')) m.remove(); });
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (f.baru.value !== f.ulang.value) { UI.toast('Ulangan sandi baru tidak sama.', 'warn'); f.ulang.focus(); return; }
      var btn = f.querySelector('.btn-p'); UI.busy(btn, true);
      try { await api('auth.gantiSandi', { lama: f.lama.value, baru: f.baru.value }); m.remove(); UI.toast('Sandi berhasil diganti.', 'ok'); }
      catch (err) { UI.toast(err.message, 'err'); UI.busy(btn, false); }
    });
  }

  async function submitWa(f) {
    var btn = f.querySelector('button:not([type="button"])'), jenis = f.dataset.form;
    UI.busy(btn, true);
    try {
      if (jenis === 'waToken') {
        var t = f.token.value.trim();
        if (!t) { UI.toast('Isi token terlebih dahulu.', 'warn'); UI.busy(btn, false); return; }
        await api('adm.waToken', { token: t }); UI.toast('Token tersimpan.', 'ok'); muatTab(); return;
      }
      if (jenis === 'waSaklar') {
        var s = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) s[x.name] = x.value; });
        await api('adm.setelanSimpan', { setelan: s }); UI.toast('Saklar notifikasi tersimpan.', 'ok'); muatTab(); return;
      }
      if (jenis === 'waTes') {
        await api('adm.waTes', { hp: f.hp.value }, { timeout: 60000 }); UI.toast('Pesan tes terkirim. Periksa WhatsApp.', 'ok');
      }
    } catch (err) { UI.toast(err.message, 'err'); }
    UI.busy(btn, false);
  }

  async function onSubmit(e) {
    var fw = e.target.closest('form[data-form^="wa"]');
    if (fw) { e.preventDefault(); return submitWa(fw); }
    var f = e.target.closest('form[data-form="setelan"]'); if (!f) return;
    e.preventDefault();
    var btn = f.querySelector('button'), data = {};
    SET_LAB.forEach(function (x) { if (f.elements[x[0]]) data[x[0]] = f.elements[x[0]].value; });
    UI.busy(btn, true, 'Menyimpan...');
    try {
      await api('adm.setelanSimpan', { setelan: data });
      try { localStorage.removeItem('ek:boot'); } catch (x) { /* abaikan */ }
      UI.toast('Pengaturan tersimpan. Portal pemohon memakai nilai baru dalam beberapa saat.', 'ok');
    } catch (err) { UI.toast(err.message, 'err'); }
    UI.busy(btn, false);
  }

  // ============================================================
  // KLIK (delegasi)
  // ============================================================
  async function klik(e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var a = t.dataset.act;
    if (a === 'keluar') keluar(false);
    else if (a === 'muat') { O.v = ''; UI.busy(t, true); await muatList(); UI.busy(t, false); if (O.route === 'detail') { delete O.det[parseRute().p.toUpperCase()]; vDetail(parseRute().p); } }
    else if (a === 'buka') { location.hash = '#/detail/' + encodeURIComponent(t.dataset.id); }
    else if (a === 'hal') { var p = Number(t.dataset.p); if (p >= 1) { O.page = p; renderTabel(); } }
    else if (a === 'kpi') { O.f.st = t.dataset.st; O.page = 1; var s = $('#fst'); if (s) s.value = O.f.st; renderTabel(); }
    else if (a === 'lihat') lihat(O.cur.id, t.dataset.j);
    else if (a === 'sesuai') verif(t.dataset.j, 'Sesuai', '');
    else if (a === 'tidak') { var box = t.closest('.fv').querySelector('[data-note]'); box.hidden = !box.hidden; if (!box.hidden) box.querySelector('textarea').focus(); }
    else if (a === 'batalNote') t.closest('[data-note]').hidden = true;
    else if (a === 'simpanNote') {
      var ta = t.closest('[data-note]').querySelector('textarea'), c = ta.value.trim();
      if (!c) { UI.toast('Catatan wajib diisi bila berkas tidak sesuai.', 'warn'); ta.focus(); return; }
      verif(t.dataset.j, 'Tidak Sesuai', c);
    }
    else if (a === 'perbaikan') {
      var cat = await promptCatatan(); if (cat === null) return;
      UI.busy(t, true);
      try { await api('off.perbaikan', { id: O.cur.id, catatan: cat }); UI.toast('Permintaan perbaikan terkirim ke pemohon.', 'ok'); delete O.det[O.cur.id]; O.v = ''; muatList(); vDetail(O.cur.id); }
      catch (err) { UI.toast(err.message, 'err'); UI.busy(t, false); }
    }
    else if (a === 'ekspor') {
      var l = O.lg || {}; UI.busy(t, true, 'Menyiapkan...');
      try { var r = await api('off.ekspor', { format: t.dataset.f, dari: l.lgDari || '', sampai: l.lgSampai || '' }, { timeout: 120000 }); UI.unduh(r.b64, r.mime, r.nama); UI.toast('Ekspor selesai (' + r.baris + ' baris).', 'ok'); }
      catch (err) { UI.toast(err.message, 'err'); }
      UI.busy(t, false);
    }
    else if (a === 'tab') { O.tab = t.dataset.t; vAdmin(); }
    else if (a === 'temaPilih') {
      var k = t.dataset.k; O.temaPilih.k = k;
      if (k === 'kustom') { if (!Tema.valid(O.temaPilih.p)) O.temaPilih.p = '#0B2545'; if (!Tema.valid(O.temaPilih.a)) O.temaPilih.a = '#C9A227'; }
      pratinjauTema();
    }
    else if (a === 'temaBatal') { kembalikanTema(); renderTema(); }
    else if (a === 'temaSimpan') {
      var tp = O.temaPilih; UI.busy(t, true, 'Menyimpan...');
      try {
        var hs = await api('adm.setelanSimpan', { setelan: { TEMA: tp.k, TEMA_PRIMER: tp.k === 'kustom' ? tp.p : '', TEMA_AKSEN: tp.k === 'kustom' ? tp.a : '' } });
        if (!hs || !hs.tersimpan || hs.tersimpan.indexOf('TEMA') < 0) {
          var e2 = new Error('Server belum mendukung tema. Timpa Kode.gs & Aman.gs di Apps Script, lalu Deploy > Kelola deployment > Edit > Versi baru.'); throw e2;
        }
        O.temaAsli = { k: tp.k, p: tp.k === 'kustom' ? tp.p : '', a: tp.k === 'kustom' ? tp.a : '' }; O.temaPilih = Object.assign({}, O.temaAsli);
        Tema.dariCfg({ TEMA: O.temaAsli.k, TEMA_PRIMER: O.temaAsli.p, TEMA_AKSEN: O.temaAsli.a });
        try { localStorage.removeItem('ek:boot'); } catch (x) { /* abaikan */ }
        UI.toast('Tema tersimpan. Portal pemohon memakai tema baru saat dibuka ulang.', 'ok'); renderTema();
      } catch (err) { kembalikanTema(); renderTema(); UI.toast(err.message, 'err'); }
    }
    else if (a === 'logoBentuk') { O.logoPilih.b = t.dataset.k; pratinjauLogo(); }
    else if (a === 'logoIkon') { O.logoPilih.i = t.dataset.k; O.logoPilih.g = ''; pratinjauLogo(); }
    else if (a === 'logoHapusGambar') { O.logoPilih.g = ''; pratinjauLogo(); }
    else if (a === 'logoBatal') { kembalikanLogo(); renderLogo(); }
    else if (a === 'logoSimpan') {
      var lp = O.logoPilih; UI.busy(t, true, 'Menyimpan...');
      try {
        var hl = await api('adm.setelanSimpan', { setelan: { LOGO_BENTUK: lp.b, LOGO_IKON: lp.i, LOGO_GAMBAR: lp.g } });
        if (!hl || !hl.tersimpan || hl.tersimpan.indexOf('LOGO_BENTUK') < 0) throw new Error('Server belum mendukung pengaturan logo. Timpa Kode.gs di Apps Script, lalu Deploy > Kelola deployment > Edit > Versi baru.');
        O.logoAsli = Object.assign({}, lp);
        try { var tm = JSON.parse(localStorage.getItem('ek_tema') || '{}'); tm.lb = lp.b; tm.li = lp.i; tm.lg = lp.g; localStorage.setItem('ek_tema', JSON.stringify(tm)); localStorage.removeItem('ek:boot'); } catch (x) { /* abaikan */ }
        UI.toast('Logo tersimpan. Portal pemohon memakai logo baru saat dibuka ulang.', 'ok'); renderLogo();
      } catch (err) { kembalikanLogo(); renderLogo(); UI.toast(err.message, 'err'); }
    }
    else if (a === 'waMuat') muatTab();
    else if (a === 'waUlang') { UI.busy(t, true); try { var u = await api('adm.waUlang'); UI.toast(u.ulang + ' pesan diantrekan ulang.', 'ok'); muatTab(); } catch (err) { UI.toast(err.message, 'err'); UI.busy(t, false); } }
    else if (a === 'waHapusToken') { if (await UI.confirm('Hapus token Fonnte?', 'Notifikasi WhatsApp berhenti sampai token baru disimpan.', 'Hapus token', true)) { try { await api('adm.waToken', { token: '__HAPUS__' }); UI.toast('Token dihapus.', 'ok'); muatTab(); } catch (err) { UI.toast(err.message, 'err'); } } }
    else if (a === 'petugasBaru') modalPetugas(null);
    else if (a === 'petugasUbah') modalPetugas({ e: t.dataset.e, n: t.dataset.n, p: t.dataset.p, a: t.dataset.a, u: t.dataset.u });
    else if (a === 'gantiSandi') modalGantiSandi();
  }

  // Prefetch detail saat kursor/jari menyentuh baris agar terbuka seketika
  APP.addEventListener('pointerover', function (e) {
    var tr = e.target.closest('tr[data-act="buka"]'); if (!tr || !O.user) return;
    var id = tr.dataset.id, c = O.det[id];
    if (c && Date.now() - c.t < 20000) return;
    Api.call('off.detail', { id: id }).then(function (d) { O.det[id] = { t: Date.now(), d: d }; }).catch(function () { });
  });

  // ============================================================
  // MULAI
  // ============================================================
  async function mulai() {
    if (!Api.configured()) {
      APP.innerHTML = '<div class="login"><div class="card"><div class="banner err">' + ic('settings') + '<div><b>Belum dikonfigurasi.</b><div class="small">Isi GAS_URL di js/config.js.</div></div></div></div></div>';
      return;
    }
    Api.warm();
    Api.swr('boot', function () { return Api.get('boot'); }, function (d) { O.boot = d; if (window.Tema) Tema.dariCfg(d.cfg); if (!O.user) renderLogin(); }).catch(function (e) { if (!O.user) UI.toast(e.message, 'err'); });
    if (Api.token()) {
      try { var r = await Api.call('auth.saya'); O.user = r.user; if (r.tema && window.Tema) Tema.dariCfg(r.tema); masukApp(); return; }
      catch (e) { Api.setToken(''); }
    }
    renderLogin();
  }
  mulai();
})();
