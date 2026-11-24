// Portal pemohon E-Kuasa: Beranda, Pendaftaran (wizard 5 langkah), Cek Status.
// SPA hash-router: pindah menu tanpa memuat ulang halaman, data dari cache lalu disegarkan.
(function () {
  var esc = UI.esc, ic = UI.ic, $ = UI.$;
  var V = $('#view');

  var S = {
    cfg: { NAMA_INSTANSI: 'Pengadilan Tata Usaha Negara', NAMA_LAYANAN: 'E-Kuasa', NOMINAL_PNBP: '10000', BANK_NAMA: '', BANK_NOREK: '', BANK_ATAS_NAMA: '', CATATAN_PENTING: '', KONTAK_ALAMAT: '', KONTAK_TELEPON: '', KONTAK_EMAIL: '', JAM_LAYANAN: '' },
    master: [], siap: false
  };
  var BOLEH_UBAH = ['Menunggu Berkas', 'Menunggu Pembayaran', 'Perlu Perbaikan'];
  var JENIS_BAYAR = 'Bukti Bayar PNBP';

  // ---------- Pendaftaran yang belum lengkap TIDAK disimpan: selalu mulai dari awal ----------
  // (draf lama dari versi sebelumnya dibersihkan sekali)
  try { localStorage.removeItem('ek_draft'); } catch (e) { /* abaikan */ }
  function draft() { return null; }
  function simpanDraft() { /* sengaja tidak menyimpan */ }
  function hapusDraft() { /* tidak ada draf */ }

  function syaratOf(kode) { return S.master.filter(function (m) { return m.kode === kode; }); }
  function kelompokNama(kode) { var m = syaratOf(kode)[0]; return m ? m.kelompok : (UI.KEL[kode] || {}).nama || kode; }

  // ---------- Boot: cache dulu (instan), lalu segarkan ----------
  function terapkanBoot(d, dariCache) {
    S.cfg = Object.assign(S.cfg, d.cfg || {});
    if (window.Tema) Tema.dariCfg(S.cfg);
    S.master = d.master || [];
    S.siap = true;
    $('#brandName').textContent = S.cfg.NAMA_INSTANSI;
    document.title = (S.cfg.NAMA_LAYANAN || 'E-Kuasa') + ' | ' + S.cfg.NAMA_INSTANSI;
    renderFoot();
    var sig = JSON.stringify([d.cfg, d.master]);
    if (sig === S.sig) return;           // data sama dengan yang sudah tampil: jangan render ulang
    S.sig = sig;
    var r = rute();
    // Render ulang hanya layar yang tidak berisi isian pengguna
    if (r.n === 'beranda') V.innerHTML = berandaHTML();
    else if (r.n === 'daftar' && !W.busy && (W.step === 1 || W.step === 4 || W.step === 5)) V.innerHTML = daftarHTML(r.p);
  }
  function renderFoot() {
    var c = S.cfg;
    $('#foot').innerHTML = '<div class="wrap"><div class="cols"><div><h4>' + esc(c.NAMA_INSTANSI) + '</h4><p class="small">Layanan pendaftaran dan legalisasi surat kuasa secara daring. Unggah berkas, bayar PNBP, dan pantau status tanpa antre.</p></div>' +
      '<div><h4>Kontak</h4><p class="small">' + (esc(c.KONTAK_ALAMAT) || '&nbsp;') + '</p>' +
      (c.KONTAK_TELEPON ? '<p class="small">Telepon: ' + esc(c.KONTAK_TELEPON) + '</p>' : '') +
      (c.KONTAK_EMAIL ? '<p class="small">Email: ' + esc(c.KONTAK_EMAIL) + '</p>' : '') + '</div>' +
      '<div><h4>Jam Layanan</h4><p class="small">' + (esc(c.JAM_LAYANAN) || 'Pengajuan daring dapat dilakukan kapan saja. Verifikasi dilakukan pada jam kerja.') + '</p></div></div>' +
      '<p class="tiny" style="margin-top:20px;opacity:.7">&copy; ' + new Date().getFullYear() + ' ' + esc(c.NAMA_INSTANSI) + '</p></div>';
  }

  // ---------- Router ----------
  function rute() {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var n = h[0] || 'beranda';
    if (['beranda', 'daftar', 'status'].indexOf(n) < 0) n = 'beranda';
    return { n: n, p: decodeURIComponent(h[1] || '') };
  }
  var ruteLalu = '';
  function tampil() {
    var r = rute();
    // Masuk ke halaman pendaftaran dari halaman lain = mulai dari langkah 1 dengan data kosong
    if (r.n === 'daftar' && ruteLalu !== 'daftar') resetWizard();
    ruteLalu = r.n;
    UI.$$('.nav a,.tabbar a').forEach(function (a) { a.classList.toggle('on', a.dataset.r === r.n); });
    if (r.n === 'beranda') V.innerHTML = berandaHTML();
    else if (r.n === 'daftar') V.innerHTML = daftarHTML(r.p);
    else statusInit(r.p);
    window.scrollTo(0, 0);
  }

  // ============================================================
  // BERANDA
  // ============================================================
  function berandaHTML() {
    var c = S.cfg;
    var kartu = ['ADV', 'INS', 'INC'].map(function (k, i) {
      var sy = syaratOf(k), kel = UI.KEL[k];
      var daftar = sy.length ? sy.map(function (s) { return '<li>' + ic('check_circle', 'fill') + '<span>' + esc(s.jenis) + '</span></li>'; }).join('') : '<li><div class="sk" style="width:100%;height:18px"></div></li>';
      return '<div class="card hover" style="display:flex;flex-direction:column;justify-content:space-between"><div class="stack-s">' +
        '<div class="row between"><span class="ico big">' + ic(kel.icon) + '</span><span class="pill gold">' + (sy.length || '…') + ' berkas wajib</span></div>' +
        '<div><span class="chip">KODE: ' + k + '</span><h3 style="margin-top:6px;font-size:20px">' + esc(sy.length ? sy[0].kelompok : kel.nama) + '</h3><p class="muted small" style="margin-top:4px">' + esc(kel.desc) + '</p></div>' +
        '<ul class="docs">' + daftar + '</ul></div>' +
        '<a class="btn ' + (i === 0 ? 'btn-p' : 'btn-o') + ' btn-block" style="margin-top:16px" href="#/daftar/' + k + '">Daftar ' + esc(kel.nama.replace('Kuasa ', '').replace('dari ', '')) + ' ' + ic('arrow_forward') + '</a></div>';
    }).join('');
    var d = draft();
    var lanjut = d ? '<div class="banner info" style="margin-bottom:16px">' + ic('edit_note') + '<div class="grow"><b>Ada pendaftaran yang belum selesai</b> (' + esc(d.id) + ').</div><a class="btn btn-s btn-p" href="#/daftar">Lanjutkan</a></div>' : '';
    var steps = [['category', 'Pilih Kuasa', 'Tentukan kelompok: ADV, INS, atau INC.'], ['edit_note', 'Isi Formulir', 'Lengkapi identitas, nomor kontak, dan email aktif.'], ['upload_file', 'Unggah Berkas', 'Scan dokumen (PDF/JPG/PNG, maks 2 MB per berkas).'], ['paid', 'Bayar PNBP ' + UI.rp(c.NOMINAL_PNBP), 'Transfer, lalu unggah bukti pembayaran.'], ['verified_user', 'Terlegalisasi', 'Setelah diverifikasi, unduh dokumen yang sudah dilegalisasi.']]
      .map(function (s, i) { return '<div class="step-c"><div class="row between" style="margin-bottom:10px"><span class="num">' + (i + 1) + '</span>' + ic(s[0]) + '</div><h4 style="font-size:16px">' + esc(s[1]) + '</h4><p class="muted small" style="margin-top:4px">' + esc(s[2]) + '</p></div>'; }).join('');
    return '<section class="hero"><div class="wrap"><div class="hero-grid"><div>' +
      '<span class="pill" style="background:#fff;border:1px solid var(--border);color:var(--text)"><span class="dot" style="color:var(--ok)"></span>Layanan daring ' + esc(c.NAMA_INSTANSI) + '</span>' +
      '<h1 style="margin-top:14px">Daftar Surat Kuasa<br>Secara <em>Online</em>.</h1>' +
      '<p class="lead">Unggah berkas persyaratan, bayar PNBP, dan pantau legalisasi dari mana saja, tanpa antre dan tanpa menyerahkan berkas fisik berulang kali.</p>' +
      '<div class="row wrap-r" style="margin-top:20px;gap:10px"><a class="btn btn-p" href="#/daftar">' + ic('how_to_reg') + 'Mulai Pendaftaran</a><a class="btn btn-o" href="#/status">' + ic('search') + 'Cek Status</a></div>' +
      '<div class="trust"><div><span class="ico">' + ic('account_balance') + '</span><div><b class="small">Layanan resmi</b><div class="tiny muted">' + esc(c.NAMA_INSTANSI) + '</div></div></div>' +
      '<div><span class="ico gold">' + ic('payments') + '</span><div><b class="small">PNBP ' + UI.rp(c.NOMINAL_PNBP) + '</b><div class="tiny muted">Per pendaftaran</div></div></div>' +
      '<div><span class="ico">' + ic('cloud_sync') + '</span><div><b class="small">Tersimpan aman</b><div class="tiny muted">Berkas terdokumentasi rapi</div></div></div></div></div>' +
      '<div class="seal"><div class="seal-bar"></div><div class="card" style="border:0;box-shadow:none"><div class="row between"><div class="row"><span class="ico big" style="width:40px;height:40px">' + ic('gavel') + '</span><div><div class="tiny bold" style="color:var(--gold-d);letter-spacing:.08em">TANPA ANTRE FISIK</div><div class="bold">Alur Pendaftaran</div></div></div><span class="pill ok">' + ic('bolt', 'fill') + 'Cepat</span></div>' +
      '<ul class="tl" style="margin-top:18px"><li class="done"><i>' + ic('check') + '</i>Isi data &amp; unggah berkas</li><li class="done"><i>' + ic('check') + '</i>Bayar PNBP &amp; unggah bukti</li><li class="now"><i></i>Petugas memverifikasi</li><li><i></i>Dokumen terlegalisasi, siap diunduh</li></ul></div></div>' +
      '</div></div></section>' +
      '<section class="wrap" style="padding-bottom:8px"><form class="card row wrap-r" style="gap:12px" data-form="cepat"><div class="row grow" style="min-width:240px"><span class="ico gold">' + ic('troubleshoot') + '</span><div><b>Cek Status Cepat</b><div class="muted small">Masukkan ID Registrasi dan Kode Akses</div></div></div>' +
      '<input class="input" style="flex:1;min-width:150px" name="id" placeholder="EKU-2026-0001" autocapitalize="characters" autocomplete="off" required aria-label="ID Registrasi">' +
      '<input class="input" style="flex:1;min-width:130px" name="akses" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off" required aria-label="Kode Akses">' +
      '<button class="btn btn-p">' + ic('search') + 'Periksa</button></form></section>' +
      '<section class="sec alt" style="margin-top:32px"><div class="wrap"><div class="sec-h"><span class="eyebrow">Klasifikasi berkas persyaratan</span><h2>Pilih Kelompok Kuasa Anda</h2><p class="muted" style="margin-top:6px">Daftar berkas menyesuaikan jenis kuasa yang Anda ajukan.</p></div><div class="grid g3">' + lanjut + kartu + '</div></div></section>' +
      '<section class="sec"><div class="wrap"><div class="sec-h"><span class="eyebrow">Panduan</span><h2>Lima Langkah Mudah</h2></div><div class="steps">' + steps + '</div>' +
      (c.CATATAN_PENTING ? '<div class="note" style="margin-top:20px">' + ic('info') + '<div><b class="small">Catatan penting</b><p class="small" style="margin-top:2px">' + esc(c.CATATAN_PENTING) + '</p></div></div>' : '') + '</div></section>';
  }

  // ============================================================
  // WIZARD PENDAFTARAN
  // ============================================================
  var W = { step: 1, kode: '', form: {}, id: '', akses: '', status: '', berkas: [], busy: false };
  var LANGKAH = ['Kelompok', 'Data', 'Berkas', 'Bayar', 'Selesai'];

  function resetWizard() { W = { step: 1, kode: '', form: {}, id: '', akses: '', status: '', berkas: [], busy: false }; }

  function stepperHTML() {
    return '<div class="stepper" aria-label="Langkah pendaftaran">' + LANGKAH.map(function (l, i) {
      var n = i + 1, cls = n < W.step ? 'done' : n === W.step ? 'on' : '';
      return '<div class="sp ' + cls + '"><i>' + (n < W.step ? ic('check') : n) + '</i>' + l + '</div>';
    }).join('') + '</div>';
  }

  function daftarHTML(param) {
    // Pra-pilih kelompok dari tautan (#/daftar/ADV) bila belum ada sesi berjalan
    if (!W.id && param && UI.KEL[param] && W.step === 1) { W.kode = param; W.step = 2; }
    var d = draft();
    if (!W.id && d && !param && W.step === 1 && !W.kode) {
      return '<div class="wiz wrap"><div class="card stack"><h2>Lanjutkan pendaftaran?</h2><p class="muted">Anda punya pendaftaran yang belum selesai: <b>' + esc(d.id) + '</b>.</p>' +
        '<div class="row wrap-r"><button class="btn btn-p" data-act="lanjutDraft">Lanjutkan</button><button class="btn btn-o" data-act="mulaiBaru">Mulai pendaftaran baru</button></div></div></div>';
    }
    var isi = '';
    if (W.step === 1) isi = step1();
    else if (W.step === 2) isi = step2();
    else if (W.step === 3) isi = step3();
    else if (W.step === 4) isi = step4();
    else isi = step5();
    return '<div class="wiz wrap">' + (W.step < 5 ? '<h1 style="font-size:24px;margin-bottom:4px">Pendaftaran Surat Kuasa</h1><p class="muted small" style="margin-bottom:12px">Langkah ' + W.step + ' dari 5</p>' : '') + stepperHTML() + isi + '</div>';
  }

  function step1() {
    var kartu = ['ADV', 'INS', 'INC'].map(function (k) {
      var sy = syaratOf(k), kel = UI.KEL[k];
      return '<button type="button" class="pick ' + (W.kode === k ? 'on' : '') + '" data-act="pilih" data-k="' + k + '" aria-pressed="' + (W.kode === k) + '"><div class="row"><span class="ico big">' + ic(kel.icon) + '</span><div class="grow"><b>' + esc(sy.length ? sy[0].kelompok : kel.nama) + '</b><div class="small muted">' + esc(kel.desc) + '</div></div><span class="pill gold">' + (sy.length || '…') + ' berkas</span></div></button>';
    }).join('');
    return '<div class="stack-s">' + kartu + '</div><div class="wiz-act"><span class="grow"></span><button class="btn btn-p ' + (W.kode && S.siap ? '' : 'off') + '" data-act="step1Lanjut">Lanjut ' + ic('arrow_forward') + '</button></div>';
  }

  function step2() {
    var f = W.form;
    var fld = function (n, label, tipe, ph, ket, extra) {
      return '<label class="field" data-f="' + n + '"><span>' + label + '</span><input class="input" name="' + n + '" type="' + tipe + '" value="' + esc(f[n] || '') + '" placeholder="' + ph + '" ' + (extra || '') + ' required>' + (ket ? '<small>' + ket + '</small>' : '') + '<em class="em"></em></label>';
    };
    var peneLabel = W.kode === 'INS' ? 'Nama Pejabat/Pegawai Penerima Kuasa atau Instansi' : W.kode === 'INC' ? 'Nama Penerima Kuasa Insidentil' : 'Nama Advokat Penerima Kuasa';
    return '<form class="card stack" data-form="data" novalidate><div class="row between"><h2 style="font-size:20px">Data Pemohon</h2><span class="chip">' + esc(W.kode) + '</span></div>' +
      fld('namaPemohon', 'Nama Pemberi Kuasa / Pemohon', 'text', 'Nama lengkap atau nama badan', '', 'autocomplete="name" maxlength="120"') +
      fld('namaPenerima', peneLabel, 'text', 'Nama lengkap beserta gelar', '', 'maxlength="160"') +
      fld('kontak', 'Nomor WhatsApp / Telepon', 'tel', '08xxxxxxxxxx', 'Untuk notifikasi status (WhatsApp bila diaktifkan) dan bila petugas perlu menghubungi Anda. Gunakan nomor seluler aktif.', 'inputmode="tel" autocomplete="tel" maxlength="20"') +
      fld('email', 'Alamat Email Aktif', 'email', 'nama@email.com', 'ID Registrasi dan Kode Akses akan dikirim ke email ini.', 'inputmode="email" autocomplete="email" maxlength="120"') +
      '<input class="sr" type="text" name="ek_cek_x9" id="ek_cek_x9" tabindex="-1" autocomplete="new-password" data-lpignore="true" data-1p-ignore aria-hidden="true">' +
      '<div class="wiz-act"><button type="button" class="btn btn-o" data-act="step2Balik">' + ic('arrow_back') + 'Kembali</button><span class="grow"></span><button class="btn btn-p" type="submit">Lanjut ' + ic('arrow_forward') + '</button></div></form>';
  }

  // ----- kartu unggah (dipakai wizard & halaman status) -----
  function cardsHTML(ctx, daftar, kunci) {
    return daftar.map(function (j) {
      var b = ctx.berkas.filter(function (x) { return x.jenis === j.jenis; })[0];
      var kunciUbah = BOLEH_UBAH.indexOf(ctx.status) < 0;
      var cls = b ? (b.status === 'Tidak Sesuai' ? 'bad' : 'done') : '';
      var pill = !b ? '<span class="pill gray">Belum diunggah</span>' : b.status === 'Sesuai' ? '<span class="pill ok">Sesuai</span>' : b.status === 'Tidak Sesuai' ? '<span class="pill err">Perlu diganti</span>' : '<span class="pill">' + ic('check', 'fill') + 'Terunggah</span>';
      return '<div class="up ' + cls + '" data-jenis="' + esc(j.jenis) + '" data-ctx="' + kunci + '"><div class="row between"><div class="row" style="min-width:0"><span class="ico">' + ic(b ? 'description' : 'upload_file') + '</span><div style="min-width:0"><b>' + esc(j.jenis) + '</b><div class="tiny muted">' + (j.wajib === false ? 'Opsional' : 'Wajib') + ' &middot; PDF, JPG, PNG &middot; maks 2 MB</div></div></div>' + pill + '</div>' +
        (b ? '<div class="small muted" style="margin-top:8px;word-break:break-all">' + esc(b.nama) + ' &middot; ' + UI.ukuran(b.ukuran) + '</div>' : '') +
        (b && b.status === 'Tidak Sesuai' && b.catatan ? '<div class="banner err" style="margin-top:8px">' + ic('error') + '<div><b>Catatan petugas:</b> ' + esc(b.catatan) + '</div></div>' : '') +
        (kunciUbah ? '' : '<label class="drop" tabindex="0" data-drop><input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-file>' + ic(b ? 'sync' : 'cloud_upload') + '<span>' + (b ? 'Ganti berkas' : 'Pilih berkas atau seret ke sini') + '</span></label>') + '</div>';
    }).join('');
  }

  function step3() {
    var sy = syaratOf(W.kode);
    var terunggah = sy.filter(function (s) { return W.berkas.some(function (b) { return b.jenis === s.jenis; }); }).length;
    var lengkap = W.status !== 'Menunggu Berkas';
    return '<div class="card"><div class="row between" style="margin-bottom:8px"><b>Unggah Berkas Persyaratan</b><span class="small muted">' + terunggah + ' / ' + sy.length + '</span></div>' +
      '<div class="bar" style="margin-bottom:12px"><i style="width:' + (sy.length ? Math.round(terunggah / sy.length * 100) : 0) + '%"></i></div>' +
      '<div class="banner info" style="margin-bottom:12px">' + ic('badge') + '<div class="small">ID Registrasi Anda <b>' + esc(W.id) + '</b>. Pendaftaran tersimpan otomatis; Anda dapat melanjutkannya nanti.</div></div>' +
      cardsHTML(W, sy, 'w') + '</div>' +
      '<div class="wiz-act"><span class="grow"></span><button class="btn btn-p ' + (lengkap ? '' : 'off') + '" data-act="step3Lanjut">Lanjut ke Pembayaran ' + ic('arrow_forward') + '</button></div>';
  }

  function infoBayarHTML() {
    var c = S.cfg;
    var rek = c.BANK_NOREK ? '<div class="copy"><div><div class="tiny muted">' + esc(c.BANK_NAMA) + (c.BANK_ATAS_NAMA ? ' a.n. ' + esc(c.BANK_ATAS_NAMA) : '') + '</div><div class="bold mono" style="font-size:20px">' + esc(c.BANK_NOREK) + '</div></div><button type="button" class="btn btn-o btn-s" data-act="salin" data-t="' + esc(c.BANK_NOREK) + '">' + ic('content_copy') + 'Salin</button></div>' :
      '<div class="banner">' + ic('info') + '<div class="small">Nomor rekening belum diatur oleh admin. Hubungi petugas untuk informasi pembayaran.</div></div>';
    return '<div class="card gold stack"><div class="center"><div class="tiny bold muted" style="letter-spacing:.08em">PNBP LEGALISASI SURAT KUASA</div><div class="fee">' + UI.rp(c.NOMINAL_PNBP) + '</div></div>' + rek +
      '<p class="small muted">Transfer sesuai nominal, simpan bukti transfer (foto atau PDF), lalu unggah di bawah ini.</p></div>';
  }

  function step4() {
    var bukti = cardsHTML(W, [{ jenis: JENIS_BAYAR, wajib: true }], 'w');
    var selesai = W.status !== 'Menunggu Pembayaran' && W.status !== 'Menunggu Berkas';
    return '<div class="stack">' + infoBayarHTML() + '<div class="card"><b style="display:block;margin-bottom:10px">Bukti Pembayaran</b>' + bukti + '</div></div>' +
      '<div class="wiz-act"><button class="btn btn-o" data-act="step4Balik">' + ic('arrow_back') + 'Kembali</button><span class="grow"></span><button class="btn btn-p ' + (selesai ? '' : 'off') + '" data-act="step4Lanjut">Selesai ' + ic('check') + '</button></div>';
  }

  function step5() {
    return '<div class="card gold stack center"><div class="ico big" style="margin:0 auto;width:64px;height:64px;background:var(--ok-bg);color:var(--ok)">' + ic('check_circle', 'fill').replace('class="ms fill"', 'class="ms fill" style="font-size:40px"') + '</div>' +
      '<h2>Pendaftaran Berhasil Dikirim</h2><p class="muted">Simpan <b>ID Registrasi</b> dan <b>Kode Akses</b> berikut. Keduanya diperlukan untuk mengecek status dan mengunduh dokumen. Salinannya juga dikirim ke email Anda.</p>' +
      '<div class="copy" style="text-align:left"><div><div class="tiny muted">ID Registrasi</div><div class="big-id">' + esc(W.id) + '</div></div><button class="btn btn-o btn-s no-print" data-act="salin" data-t="' + esc(W.id) + '">' + ic('content_copy') + 'Salin</button></div>' +
      '<div class="copy" style="text-align:left"><div><div class="tiny muted">Kode Akses</div><div class="big-id">' + esc(W.akses) + '</div></div><button class="btn btn-o btn-s no-print" data-act="salin" data-t="' + esc(W.akses) + '">' + ic('content_copy') + 'Salin</button></div>' +
      '<div class="banner info" style="text-align:left">' + ic('pending_actions') + '<div class="small">Berkas Anda akan diperiksa petugas. Bila ada yang perlu diperbaiki, Anda akan menerima email dan dapat mengunggah ulang lewat menu Cek Status.</div></div>' +
      '<div class="row wrap-r no-print" style="justify-content:center"><button class="btn btn-p" data-act="cekStatusBaru">' + ic('search') + 'Cek Status</button><button class="btn btn-o" data-act="cetak">' + ic('print') + 'Cetak</button><button class="btn btn-t" data-act="mulaiBaru">Daftar lagi</button></div></div>';
  }

  // ---------- Validasi form data ----------
  function validasiForm(f) {
    var e = {};
    if ((f.namaPemohon || '').trim().length < 3) e.namaPemohon = 'Nama wajib diisi (minimal 3 karakter).';
    if ((f.namaPenerima || '').trim().length < 3) e.namaPenerima = 'Nama penerima kuasa wajib diisi.';
    if (!/^\+?\d{8,15}$/.test((f.kontak || '').replace(/[\s-]/g, ''))) e.kontak = 'Nomor tidak valid (8-15 digit).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((f.email || '').trim())) e.email = 'Alamat email tidak valid.';
    return e;
  }

  // ---------- Unggah berurutan (satu per satu, aman dari batas payload GAS) ----------
  var antrean = Promise.resolve();
  function unggah(ctx, jenis, file, cardEl, selesai) {
    antrean = antrean.then(function () { return unggahSatu(ctx, jenis, file, cardEl, selesai); });
  }
  async function unggahSatu(ctx, jenis, file, cardEl, selesai) {
    var drop = $('[data-drop]', cardEl), label = drop && $('span', drop);
    var awal = label ? label.textContent : '';
    if (drop) drop.classList.add('busy');
    ctx.sibuk = true; W.busy = true;
    try {
      if (label) label.textContent = 'Menyiapkan berkas...';
      var b = await UI.siapkanBerkas(file);
      if (b.dikompres) UI.toast('Foto diperkecil otomatis menjadi ' + UI.ukuran(b.ukuran) + '.', 'ok');
      if (label) label.textContent = 'Mengunggah...';
      var r = await Api.call('reg.unggah', { id: ctx.id, akses: ctx.akses, jenis: jenis, nama: b.nama, b64: b.b64 }, { timeout: 120000 });
      ctx.berkas = r.berkas; ctx.status = r.status;
      UI.toast(jenis + ' berhasil diunggah.', 'ok');
      if (selesai) selesai(r);
    } catch (e) {
      UI.toast(e.message, 'err');
      if (label) label.textContent = awal;
      if (drop) drop.classList.remove('busy');
    } finally { ctx.sibuk = false; W.busy = false; }
  }

  // ============================================================
  // CEK STATUS
  // ============================================================
  var ST = null;          // hasil status terakhir {data, akses}
  var cari = null;        // pencarian tertunda dari beranda/wizard {id, akses}
  var LINI = ['Menunggu Berkas', 'Menunggu Pembayaran', 'Menunggu Verifikasi', 'Terlegalisasi'];

  function statusInit(param) {
    var d = draft(), last = '';
    try { last = localStorage.getItem('ek_lastid') || ''; } catch (e) { /* abaikan */ }
    var id = param || (cari && cari.id) || (d && d.id) || last || '';
    var ak = (cari && cari.akses) || (d && d.id === id ? d.akses : '');
    if (ST && !cari && (!param || param === ST.data.id)) { V.innerHTML = statusFormHTML(id, '', statusHasilInner()); return; }
    V.innerHTML = statusFormHTML(id, ak, '');
    if (cari) { var c = cari; cari = null; jalankanCari(c.id, c.akses); }
  }
  function statusFormHTML(id, ak, hasil) {
    return '<div class="wiz wrap" style="max-width:820px"><h1 style="font-size:24px;margin-bottom:12px">Cek Status Pendaftaran</h1>' +
      '<form class="card row wrap-r no-print" style="gap:12px;align-items:flex-end" data-form="status">' +
      '<label class="field grow" style="min-width:160px"><span>ID Registrasi</span><input class="input" name="id" value="' + esc(id) + '" placeholder="EKU-2026-0001" autocapitalize="characters" autocomplete="off" required></label>' +
      '<label class="field grow" style="min-width:140px"><span>Kode Akses</span><input class="input" name="akses" value="' + esc(ak) + '" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off" required></label>' +
      '<button class="btn btn-p" style="min-height:48px">' + ic('search') + 'Periksa</button></form><div id="hasil" style="margin-top:16px">' + (hasil || '') + '</div></div>';
  }
  async function jalankanCari(id, akses, tombol) {
    var h = $('#hasil');
    if (!h) return;
    h.innerHTML = '<div class="card stack"><div class="sk" style="height:22px;width:50%"></div><div class="sk" style="height:90px"></div><div class="sk" style="height:60px"></div></div>';
    UI.busy(tombol, true);
    try {
      var r = await Api.call('reg.status', { id: id, akses: akses });
      ST = { data: r, akses: akses };
      try { localStorage.setItem('ek_lastid', r.id); } catch (e) { /* abaikan */ }
      h.innerHTML = statusHasilInner();
    } catch (e) {
      ST = null;
      h.innerHTML = '<div class="banner err">' + ic('error') + '<div>' + esc(e.message) + '</div></div>';
    } finally { UI.busy(tombol, false); }
  }
  function statusHasilInner() {
    if (!ST) return '';
    var r = ST.data, c = S.cfg;
    var idx = LINI.indexOf(r.status), perbaikan = r.status === 'Perlu Perbaikan';
    var tl = LINI.map(function (l, i) {
      var cls = '', ik = '', lab = l;
      if (perbaikan) { if (i < 2) { cls = 'done'; ik = ic('check'); } else if (i === 2) { cls = 'bad'; ik = ic('priority_high'); lab = 'Perlu Perbaikan'; } }
      else if (i < idx) { cls = 'done'; ik = ic('check'); } else if (i === idx) { cls = i === 3 ? 'done' : 'now'; ik = i === 3 ? ic('check') : ''; }
      return '<li class="' + cls + '"><i>' + ik + '</i>' + esc(lab) + '</li>';
    }).join('');
    var bisaUbah = BOLEH_UBAH.indexOf(r.status) > -1;
    var daftar = r.syarat.map(function (s) { return { jenis: s.jenis, wajib: s.wajib }; });
    if (r.status !== 'Menunggu Berkas') daftar.push({ jenis: JENIS_BAYAR, wajib: true });
    var aksi = '';
    if (r.status === 'Terlegalisasi') aksi = '<div class="card gold stack"><div class="row"><span class="ico" style="background:var(--ok-bg);color:var(--ok)">' + ic('verified', 'fill') + '</span><div><b>Dokumen sudah dilegalisasi</b><div class="small muted">Unduh dokumen resmi Anda di bawah ini.</div></div></div><button class="btn btn-ok" data-act="unduhLegal">' + ic('download') + 'Unduh Dokumen Legalisasi</button></div>';
    else if (perbaikan) aksi = '<div class="banner err">' + ic('error') + '<div><b>Berkas perlu diperbaiki.</b>' + (r.catatan ? '<div class="small" style="margin-top:2px">' + esc(r.catatan) + '</div>' : '') + '<div class="small" style="margin-top:4px">Unggah ulang berkas yang bertanda &ldquo;Perlu diganti&rdquo;. Setelah semua diganti, berkas otomatis dikirim kembali ke petugas.</div></div></div>';
    else if (r.status === 'Menunggu Verifikasi') aksi = '<div class="banner info">' + ic('pending_actions') + '<div class="small">Berkas dan bukti bayar sudah diterima. Petugas sedang memeriksa. Anda akan diberi tahu lewat email.</div></div>';
    return '<div class="stack"><div class="card"><div class="row between wrap-r" style="gap:8px"><div><div class="tiny muted">ID Registrasi</div><div class="big-id" style="font-size:22px">' + esc(r.id) + '</div></div>' + UI.status(r.status) + '</div>' +
      '<div class="grid g2" style="margin-top:14px;gap:10px"><div><div class="tiny muted">Kelompok</div><b class="small">' + esc(r.kelompok) + '</b></div><div><div class="tiny muted">Tanggal daftar</div><b class="small">' + UI.tgl(r.tanggal, true) + '</b></div>' +
      '<div><div class="tiny muted">Pemohon</div><b class="small">' + esc(r.pemohon) + '</b></div><div><div class="tiny muted">Penerima kuasa / instansi</div><b class="small">' + esc(r.penerima) + '</b></div></div></div>' +
      aksi + '<div class="card"><b style="display:block;margin-bottom:12px">Progres</b><ul class="tl">' + tl + '</ul></div>' +
      (r.status === 'Menunggu Pembayaran' ? infoBayarHTML() : '') +
      '<div class="card"><b style="display:block;margin-bottom:10px">Berkas</b>' + (bisaUbah ? cardsHTML(r, daftar, 's') : berkasRingkas(r)) + '</div></div>';
  }
  function berkasRingkas(r) {
    var rows = r.berkas.filter(function (b) { return b.jenis !== 'Dokumen Legalisasi'; });
    if (!rows.length) return '<p class="muted small">Belum ada berkas.</p>';
    return rows.map(function (b) {
      return '<div class="row between" style="padding:8px 0;border-top:1px solid var(--border)"><div style="min-width:0"><b class="small">' + esc(b.jenis) + '</b><div class="tiny muted">' + UI.ukuran(b.ukuran) + ' &middot; ' + UI.tgl(b.waktu, true) + '</div></div>' + UI.vstat(b.status === 'Menunggu' ? 'Menunggu' : b.status) + '</div>';
    }).join('');
  }

  // ============================================================
  // EVENT (delegasi): satu pendengar per jenis event
  // ============================================================
  V.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.dataset.act, k;
    if (a === 'pilih') { W.kode = t.dataset.k; V.innerHTML = daftarHTML(); }
    else if (a === 'step1Lanjut') { if (W.kode) { W.step = 2; V.innerHTML = daftarHTML(); window.scrollTo(0, 0); } }
    else if (a === 'step2Balik') { W.step = 1; V.innerHTML = daftarHTML(); }
    else if (a === 'step3Lanjut') { if (W.status !== 'Menunggu Berkas') { W.step = 4; V.innerHTML = daftarHTML(); window.scrollTo(0, 0); } }
    else if (a === 'step4Balik') { W.step = 3; V.innerHTML = daftarHTML(); }
    else if (a === 'step4Lanjut') { if (W.status !== 'Menunggu Pembayaran' && W.status !== 'Menunggu Berkas') { hapusDraft(); W.step = 5; V.innerHTML = daftarHTML(); window.scrollTo(0, 0); } }
    else if (a === 'mulaiBaru') { hapusDraft(); resetWizard(); V.innerHTML = daftarHTML(); }
    else if (a === 'lanjutDraft') lanjutDraft(t);
    else if (a === 'salin') UI.salin(t.dataset.t);
    else if (a === 'cetak') window.print();
    else if (a === 'cekStatusBaru') { cari = { id: W.id, akses: W.akses }; location.hash = '#/status'; }
    else if (a === 'unduhLegal') {
      UI.busy(t, true, 'Menyiapkan...');
      try { k = await Api.call('reg.unduhLegal', { id: ST.data.id, akses: ST.akses }, { timeout: 90000 }); UI.unduh(k.b64, k.mime, k.nama); }
      catch (err) { UI.toast(err.message, 'err'); }
      UI.busy(t, false);
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (rute().n === 'daftar' && W.step > 1 && W.step < 5) { e.preventDefault(); e.returnValue = ''; }
  });

  async function lanjutDraft(btn) {
    var d = draft(); if (!d) return;
    UI.busy(btn, true);
    try {
      var r = await Api.call('reg.status', { id: d.id, akses: d.akses });
      W = { step: 3, kode: r.kode, form: {}, id: r.id, akses: d.akses, status: r.status, berkas: r.berkas, busy: false };
      if (r.status === 'Menunggu Pembayaran') W.step = 4;
      if (['Menunggu Verifikasi', 'Terlegalisasi', 'Perlu Perbaikan'].indexOf(r.status) > -1) { hapusDraft(); resetWizard(); cari = { id: r.id, akses: d.akses }; location.hash = '#/status'; return; }
      V.innerHTML = daftarHTML();
    } catch (e) { UI.toast(e.message, 'err'); hapusDraft(); resetWizard(); V.innerHTML = daftarHTML(); }
  }

  V.addEventListener('submit', async function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var jenis = f.dataset.form, btn = f.querySelector('button[type=submit],button:not([type])');
    if (jenis === 'cepat') {
      cari = { id: f.id.value.trim().toUpperCase(), akses: f.akses.value.trim() };
      ST = null;
      if (location.hash === '#/status') tampil(); else location.hash = '#/status';
    } else if (jenis === 'status') {
      ST = null;
      jalankanCari(f.id.value.trim().toUpperCase(), f.akses.value.trim(), btn);
    } else if (jenis === 'data') {
      var vals = {};
      ['namaPemohon', 'namaPenerima', 'kontak', 'email'].forEach(function (n) { vals[n] = f[n].value; });
      W.form = vals;
      var er = validasiForm(vals), ada = Object.keys(er);
      UI.$$('.field', f).forEach(function (el) { var m = er[el.dataset.f]; el.classList.toggle('err', !!m); var em = $('.em', el); if (em) em.textContent = m || ''; });
      if (ada.length) { var el = f[ada[0]]; if (el) el.focus(); return; }
      UI.busy(btn, true, 'Mendaftarkan...');
      try {
        var r = await Api.call('reg.buat', { kode: W.kode, namaPemohon: vals.namaPemohon, namaPenerima: vals.namaPenerima, kontak: vals.kontak, email: vals.email, hp: f.ek_cek_x9.value });
        W.id = r.id; W.akses = r.akses; W.status = r.status; W.berkas = []; W.step = 3;
        simpanDraft({ id: r.id, akses: r.akses, kode: W.kode });
        try { localStorage.setItem('ek_lastid', r.id); } catch (e2) { /* abaikan */ }
        V.innerHTML = daftarHTML(); window.scrollTo(0, 0);
      } catch (err) { UI.toast(err.message, 'err'); UI.busy(btn, false); }
    }
  });

  function ctxDari(card) { return card.dataset.ctx === 'w' ? W : ST && ST.data ? { id: ST.data.id, akses: ST.akses, get berkas() { return ST.data.berkas; }, set berkas(v) { ST.data.berkas = v; }, get status() { return ST.data.status; }, set status(v) { ST.data.status = v; } } : null; }

  V.addEventListener('change', function (e) {
    var inp = e.target.closest('input[data-file]');
    if (!inp || !inp.files[0]) return;
    var card = inp.closest('.up'), ctx = ctxDari(card);
    if (!ctx) return;
    var wiz = card.dataset.ctx === 'w';
    unggah(ctx, card.dataset.jenis, inp.files[0], card, function () {
      var n = rute().n;                  // jangan menimpa layar lain bila pengguna sudah pindah menu
      if (wiz && n === 'daftar') V.innerHTML = daftarHTML();
      else if (!wiz && n === 'status') { var h = $('#hasil'); if (h) h.innerHTML = statusHasilInner(); }
    });
    inp.value = '';
  });
  // seret & lepas
  V.addEventListener('dragover', function (e) { var d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  V.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
  V.addEventListener('drop', function (e) {
    var d = e.target.closest('[data-drop]'); if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    var file = e.dataTransfer.files[0]; if (!file) return;
    var inp = $('input[data-file]', d), dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  V.addEventListener('keydown', function (e) { var d = e.target.closest('[data-drop]'); if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('input[data-file]', d).click(); } });
  // normalisasi input kode akses & ID: huruf kapital otomatis
  V.addEventListener('input', function (e) {
    var el = e.target;
    if (el.name === 'akses' || el.name === 'id') { var p = el.selectionStart; el.value = el.value.toUpperCase(); try { el.setSelectionRange(p, p); } catch (x) { /* abaikan */ } }
  });

  // ============================================================
  // MULAI
  // ============================================================
  window.addEventListener('hashchange', tampil);
  window.addEventListener('beforeunload', function (e) { if (W.sibuk || W.busy) { e.preventDefault(); e.returnValue = ''; } });

  if (!Api.configured()) {
    V.innerHTML = '<div class="wrap" style="padding:40px 16px"><div class="banner err">' + ic('settings') + '<div><b>Aplikasi belum dikonfigurasi.</b><div class="small">Isi <code>GAS_URL</code> di <code>js/config.js</code> dengan URL Web App Google Apps Script (akhiran /exec).</div></div></div></div>';
  } else {
    tampil();            // render instan dengan nilai bawaan
    Api.warm();          // bangunkan server sambil pengguna membaca
    Api.swr('boot', function () { return Api.get('boot'); }, terapkanBoot).catch(function (e) {
      UI.toast('Gagal memuat data layanan: ' + e.message, 'err');
    });
    // Portal yang lama terbuka: ambil ulang pengaturan (termasuk tema) saat tab kembali dilihat
    var bootTerakhir = Date.now();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || Date.now() - bootTerakhir < 60000) return;
      bootTerakhir = Date.now();
      Api.get('boot').then(function (d) { try { localStorage.setItem('ek:boot', JSON.stringify({ t: Date.now(), d: d })); } catch (x) { /* abaikan */ } terapkanBoot(d, false); }).catch(function () { });
    });
  }
})();
