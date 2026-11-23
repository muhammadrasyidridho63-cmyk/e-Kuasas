// Klien REST untuk Google Apps Script. POST selalu text/plain agar tidak memicu preflight CORS.
(function () {
  var URL_ = window.GAS_URL || '';
  var inflight = {};
  var epoch = 0;
  var READ = /^(boot|off\.list|off\.detail|adm\.petugas|adm\.log|adm\.setelan|reg\.status)$/;

  function tokenGet() { try { return sessionStorage.getItem('ek_token') || ''; } catch (e) { return ''; } }
  function tokenSet(t) { try { t ? sessionStorage.setItem('ek_token', t) : sessionStorage.removeItem('ek_token'); } catch (e) { /* abaikan */ } }

  function ok() { return /^https:\/\/script\.google\.com\//.test(URL_); }

  async function fetchJson(url, init, ms) {
    var ctl = new AbortController();
    var to = setTimeout(function () { ctl.abort(); }, ms);
    try {
      init.signal = ctl.signal;
      var res = await fetch(url, init);
      return await res.json();
    } finally { clearTimeout(to); }
  }

  async function run(action, data, opt, attempt) {
    try {
      var j = await fetchJson(URL_, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // WAJIB text/plain
        body: JSON.stringify({ action: action, data: data || {}, token: tokenGet() })
      }, (opt && opt.timeout) || 60000);
      if (!j.success) { var e = new Error(j.message || 'Permintaan gagal.'); e.code = j.code; throw e; }
      return j.data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Koneksi terlalu lama. Silakan coba lagi.');
      if (err instanceof TypeError || err instanceof SyntaxError) {
        if (attempt < 1 && READ.test(action)) return run(action, data, opt, attempt + 1); // ulang sekali (hanya baca)
        throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      }
      throw err;
    }
  }

  var Api = {
    configured: ok,
    token: tokenGet,
    setToken: tokenSet,
    // Panggilan standar. Permintaan baca identik yang sedang berjalan dipakai bersama (dedup).
    call: function (action, data, opt) {
      if (!ok()) return Promise.reject(new Error('GAS_URL belum diisi di js/config.js.'));
      if (!READ.test(action)) { epoch++; return run(action, data, opt, 0); }
      var k = epoch + '|' + action + '|' + JSON.stringify(data || {});
      if (inflight[k]) return inflight[k];
      var p = run(action, data, opt, 0);
      inflight[k] = p;
      var clear = function () { delete inflight[k]; };
      p.then(clear, clear);
      return p;
    },
    // GET sederhana untuk data publik (tanpa body, tanpa preflight)
    get: async function (action) {
      if (!ok()) throw new Error('GAS_URL belum diisi di js/config.js.');
      var k = 'GET|' + action;
      if (inflight[k]) return inflight[k];
      var p = fetchJson(URL_ + '?action=' + encodeURIComponent(action), { redirect: 'follow' }, 45000).then(function (j) {
        if (!j.success) throw new Error(j.message || 'Gagal memuat data.');
        return j.data;
      });
      inflight[k] = p;
      var clear = function () { delete inflight[k]; };
      p.then(clear, clear);
      return p;
    },
    // Pemanasan server saat halaman dibuka (mengurangi jeda cold-start pada klik pertama)
    warm: function () { if (ok()) { fetch(URL_ + '?action=ping', { redirect: 'follow' }).catch(function () { }); } },
    // Stale-while-revalidate: tampilkan cache seketika, segarkan di latar belakang.
    swr: function (key, fetcher, cb, store) {
      var st = store === 'session' ? sessionStorage : localStorage, hit = null;
      try { var s = st.getItem('ek:' + key); if (s) hit = JSON.parse(s); } catch (e) { /* abaikan */ }
      if (hit) { try { cb(hit.d, true); } catch (e) { console.error(e); } }
      return fetcher().then(function (d) {
        try { st.setItem('ek:' + key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { /* kuota penuh */ }
        cb(d, false);
        return d;
      }).catch(function (e) { if (!hit) throw e; });
    },
    cacheClear: function () { try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('ek:') === 0) sessionStorage.removeItem(k); }); } catch (e) { /* abaikan */ } }
  };
  window.Api = Api;
})();
