// Helper UI bersama (portal pemohon & dashboard petugas)
(function () {
  var UI = {};

  UI.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.$ = function (sel, el) { return (el || document).querySelector(sel); };
  UI.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  UI.ic = function (n, cls) { return '<span class="ms' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + n + '</span>'; };
  UI.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };

  var TZ = 'Asia/Jakarta';
  UI.tgl = function (iso, jam) {
    var d = new Date(iso); if (isNaN(d)) return '-';
    var o = { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ };
    if (jam) { o.hour = '2-digit'; o.minute = '2-digit'; o.hour12 = false; }
    return d.toLocaleString('id-ID', o).replace(/\./g, ':').replace(',', '');
  };
  UI.ukuran = function (b) { b = Number(b) || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
  UI.rp = function (n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); };

  var ST = {
    'Menunggu Berkas': ['gray', 'upload_file'], 'Menunggu Pembayaran': ['warn', 'receipt_long'],
    'Menunggu Verifikasi': ['', 'pending_actions'], 'Perlu Perbaikan': ['err', 'error'], 'Terlegalisasi': ['ok', 'verified']
  };
  UI.status = function (s) { var m = ST[s] || ['gray', 'help']; return '<span class="pill ' + m[0] + '">' + UI.ic(m[1], s === 'Terlegalisasi' ? 'fill' : '') + UI.esc(s) + '</span>'; };
  UI.vstat = function (s) {
    var m = { 'Sesuai': 'ok', 'Tidak Sesuai': 'err', 'Menunggu': 'gray' }[s] || 'gray';
    return '<span class="pill ' + m + '">' + UI.esc(s || 'Menunggu') + '</span>';
  };
  UI.KEL = {
    ADV: { nama: 'Kuasa dari Advokat', icon: 'gavel', desc: 'Untuk advokat yang telah disumpah dan berpraktik, bertindak atas nama pemberi kuasa.' },
    INS: { nama: 'Kuasa Instansi Pemerintah', icon: 'account_balance', desc: 'Untuk pejabat atau pegawai yang mewakili badan atau pejabat pemerintahan.' },
    INC: { nama: 'Kuasa Insidentil', icon: 'group', desc: 'Untuk pemberian kuasa perorangan kepada pihak yang memiliki hubungan keluarga.' }
  };

  // ---------- Toast ----------
  UI.toast = function (msg, tipe) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var el = document.createElement('div');
    el.className = 'toast ' + (tipe || '');
    var ik = { ok: 'check_circle', err: 'error', warn: 'warning' }[tipe] || 'info';
    el.innerHTML = UI.ic(ik, 'fill') + '<div>' + UI.esc(msg) + '</div>';
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 300); }, tipe === 'err' ? 6000 : 3500);
  };

  // ---------- Modal konfirmasi ----------
  UI.confirm = function (judul, isi, label, bahaya) {
    return new Promise(function (res) {
      var m = document.createElement('div');
      m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      m.innerHTML = '<div class="sheet"><h3>' + UI.esc(judul) + '</h3><p class="muted" style="margin:8px 0 18px">' + UI.esc(isi) + '</p>' +
        '<div class="row" style="justify-content:flex-end"><button class="btn btn-o" data-n>Batal</button><button class="btn ' + (bahaya ? 'btn-d' : 'btn-p') + '" data-y>' + UI.esc(label || 'Lanjut') + '</button></div></div>';
      document.body.appendChild(m);
      var done = function (v) { m.remove(); res(v); };
      m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-n')) done(false); else if (e.target.hasAttribute('data-y')) done(true); });
      UI.$('[data-y]', m).focus();
    });
  };

  UI.salin = function (teks) {
    var fb = function () { var t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* abaikan */ } t.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(teks).then(function () { UI.toast('Tersalin.', 'ok'); }, function () { fb(); UI.toast('Tersalin.', 'ok'); });
    else { fb(); UI.toast('Tersalin.', 'ok'); }
  };

  UI.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (label ? ' ' + UI.esc(label) : ''); }
    else { btn.disabled = false; if (btn.dataset.h) btn.innerHTML = btn.dataset.h; }
  };

  // ---------- Berkas ----------
  var MAKS = 2 * 1024 * 1024;
  function bacaDataUrl(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result)); };
      r.onerror = function () { rej(new Error('Berkas tidak dapat dibaca.')); };
      r.readAsDataURL(file);
    });
  }
  function muatGambar(url) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Gambar tidak dapat dibuka.')); }; i.src = url; });
  }
  function kompres(img, sisi, q) {
    var s = Math.min(1, sisi / Math.max(img.width, img.height));
    var c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  }
  var kb = function (du) { return Math.round((du.length - du.indexOf(',') - 1) * 0.75); };

  // Validasi + kompres otomatis foto > 2 MB. Mengembalikan {b64, nama, ukuran, mime}
  UI.siapkanBerkas = async function (file, maks) {
    maks = maks || MAKS;
    var nama = file.name || 'berkas';
    var tipe = (file.type || '').toLowerCase();
    var ext = (nama.split('.').pop() || '').toLowerCase();
    var pdf = tipe === 'application/pdf' || ext === 'pdf';
    var img = /^image\/(jpeg|png)$/.test(tipe) || /^(jpe?g|png)$/.test(ext);
    if (!pdf && !img) throw new Error('Format harus PDF, JPG, atau PNG.');
    var du = await bacaDataUrl(file);
    if (kb(du) <= maks) return { b64: du.slice(du.indexOf(',') + 1), nama: nama, ukuran: kb(du), mime: pdf ? 'application/pdf' : tipe };
    if (pdf) throw new Error('PDF melebihi ' + (maks / 1048576) + ' MB. Perkecil ukuran file (mis. scan resolusi lebih rendah).');
    var im = await muatGambar(du), out = '';
    var tahap = [[2000, .85], [1600, .8], [1400, .7], [1200, .6], [1000, .5]];
    for (var i = 0; i < tahap.length; i++) { out = kompres(im, tahap[i][0], tahap[i][1]); if (kb(out) <= maks) break; }
    if (kb(out) > maks) throw new Error('Foto terlalu besar. Gunakan foto dengan resolusi lebih rendah.');
    return { b64: out.slice(out.indexOf(',') + 1), nama: nama.replace(/\.\w+$/, '') + '.jpg', ukuran: kb(out), mime: 'image/jpeg', dikompres: true };
  };

  UI.blobUrl = function (b64, mime) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: mime }));
  };
  UI.unduh = function (b64, mime, nama) {
    var a = document.createElement('a'); a.href = UI.blobUrl(b64, mime); a.download = nama;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  window.UI = UI;
})();
