/* Building 100 - demand forecast per material (Holt for steady demand, Croston for intermittent spares) and forecast-based min / max */
(function () {
  const B = window.B100, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const Z = { A: 2.05, B: 1.65, C: 1.28 }; // service level 98%, 95%, 90%
  const H = 12; // weeks ahead

  // Holt's smoothing with a damped trend, so a short rise is not projected for ever
  function holt(w, a = 0.35, b = 0.12, phi = 0.85) {
    let L = w[0], T = (w[Math.min(3, w.length - 1)] - w[0]) / Math.min(3, w.length - 1 || 1), err = [];
    for (let i = 1; i < w.length; i++) { const f = Math.max(0, L + T); err.push(w[i] - f); const L2 = a * w[i] + (1 - a) * (L + phi * T); T = b * (L2 - L) + (1 - b) * phi * T; L = L2; }
    return { f: (h) => { let d = 0; for (let i = 1; i <= h; i++) d += Math.pow(phi, i); return Math.max(0, L + d * T); }, err };
  }
  // Croston: average size of a demand divided by the average gap between demands
  function croston(w, a = 0.15) {
    const hits = w.filter((v) => v > 0).length;
    let z = null, p = hits ? w.length / hits : 1, q = 1;
    const err = [];
    for (let i = 0; i < w.length; i++) {
      if (z != null) err.push(w[i] - z / p);
      if (w[i] > 0) { if (z == null) z = w[i]; else { z = a * w[i] + (1 - a) * z; p = a * q + (1 - a) * p; } q = 1; } else q++;
    }
    const rate = z == null ? 0 : z / p;
    return { f: () => rate, err };
  }
  function forecast(weeks) {
    const zeros = weeks.filter((v) => v <= 0.0001).length / weeks.length;
    const method = zeros > 0.4 ? 'Croston' : 'Holt';
    const fit = (w) => (method === 'Croston' ? croston(w) : holt(w));
    const m = fit(weeks);
    const past = weeks.reduce((a, b) => a + b, 0) / weeks.length;
    const ahead = []; for (let h = 1; h <= H; h++) ahead.push(Math.min(m.f(h), past * 2.5 + 0.01));
    const fm = ahead.reduce((a, b) => a + b, 0) / H;
    // forecast error, capped like the fixed rule so one spike does not inflate safety stock
    const sigma = Math.min(Math.sqrt(m.err.reduce((s, e) => s + e * e, 0) / Math.max(1, m.err.length)), 1.2 * Math.max(fm, past));
    // back-test: fit on the first 9 weeks, check against the last 4
    const bt = fit(weeks.slice(0, 9)), act = weeks.slice(9);
    let absErr = 0, sum = 0; act.forEach((a, i) => { absErr += Math.abs(a - bt.f(i + 1)); sum += a; });
    const next4 = (ahead[0] + ahead[1] + ahead[2] + ahead[3]) / 4;
    return { method, ahead, sigma, mean: fm, next4, past, acc: sum ? Math.max(0, 1 - absErr / sum) : null, trend: past ? next4 / past - 1 : 0 };
  }

  const cache = new Map();
  function of(r) {
    const key = r.it.mat + '|' + r.it.name + '|' + r.weeks.map((v) => v.toFixed(3)).join(',');
    if (!cache.has(key)) cache.set(key, forecast(r.weeks));
    return cache.get(key);
  }
  function adjust(r, lt) {
    const f = of(r), z = r.critical ? 2.33 : Z[r.abc] || 1.65;
    r.min = Math.ceil(f.mean * lt * 0.35 + z * f.sigma * Math.sqrt(lt));
    r.max = Math.max(r.min + 1, Math.ceil(r.min + f.mean * 8));
    r.forecast = f;
  }

  let pick = null;
  function render(el) {
    const st = B.stock.compute(true), rows = st.rows.filter((r) => r.pallets).sort((a, b) => b.annual - a.annual);
    const fs = rows.map((r) => ({ r, f: of(r) }));
    const wAcc = fs.filter((q) => q.f.acc != null), accAll = wAcc.reduce((n, q) => n + q.f.acc * q.r.annual, 0) / Math.max(1, wAcc.reduce((n, q) => n + q.r.annual, 0));
    const up = fs.filter((q) => q.f.trend > 0.1).length, down = fs.filter((q) => q.f.trend < -0.1).length;
    const lead = B.stock.LEAD, changed = fs.filter(({ r }) => { const t = Object.assign({}, r); adjust(t, lead[r.it.cat] || 8); return t.min !== r.minBase; });
    const ssDelta = fs.reduce((n, { r }) => { const t = Object.assign({}, r); adjust(t, lead[r.it.cat] || 8); return n + (t.min - r.minBase) * r.price; }, 0);
    pick = pick && fs.find((q) => q.r.it === pick) ? pick : fs[0] && fs[0].r.it;
    const sel = fs.find((q) => q.r.it === pick);
    const arrow = (t) => (t > 0.1 ? '<b style="color:var(--bad)">▲ ' + fmt(t * 100, 0) + '%</b>' : t < -0.1 ? '<b style="color:var(--ok)">▼ ' + fmt(-t * 100, 0) + '%</b>' : '→ steady');
    el.innerHTML = `<h4>Demand forecast</h4><p>Each material's weekly issues are forecast 12 weeks ahead. Steady items use Holt's method (level and trend); spares that are issued only now and then use Croston's method, which is built for intermittent demand.</p>
      <div class="row2"><div class="stat"><b>${fmt(accAll * 100, 0)}%</b><small>forecast accuracy, tested on the last 4 weeks</small></div><div class="stat"><b>${up} ▲ / ${down} ▼</b><small>materials rising / falling</small></div>
      <div class="stat"><b>${changed.length}</b><small>minimum levels the forecast would change</small></div><div class="stat"><b>${ssDelta >= 0 ? '+' : '-'}${B.stock.sar(Math.abs(ssDelta))}</b><small>change in safety stock value</small></div></div>
      <div class="btnrow"><button class="btn ${B.demand.auto ? '' : 'primary'}" id="dmAuto">${B.demand.auto ? 'Back to fixed min / max' : 'Set min / max from the forecast'}</button><button class="btn" id="dmCsv">Export forecast (CSV)</button></div>
      <p>${B.demand.auto ? '<b>On:</b> min and max follow the forecast. Class A items keep 98% service, B 95%, C 90%, critical spares 99%.' : 'Off: min and max use the fixed rule from lead time and average use.'}</p>
      ${sel ? `<h4>${P.esc(sel.r.it.name)} · ${sel.f.method}</h4><canvas id="dmChart" width="840" height="300"></canvas>` : ''}
      <table><thead><tr><th>Material</th><th class="num">Last 13 wk</th><th class="num">Next 4 wk</th><th>Trend</th><th class="num">Min now → forecast</th></tr></thead><tbody>
      ${fs.slice(0, 20).map(({ r, f }) => { const t = Object.assign({}, r); adjust(t, lead[r.it.cat] || 8); return '<tr data-i="' + r.it.i + '" style="cursor:pointer' + (r.it === pick ? ';font-weight:700' : '') + '"><td>' + P.esc(r.it.name) + '<br><small>' + r.abc + r.xyz + ' · ' + f.method + '</small></td><td class="num">' + fmt(f.past, 1) + '/wk</td><td class="num">' + fmt(f.next4, 1) + '/wk</td><td>' + arrow(f.trend) + '</td><td class="num">' + fmt(r.minBase) + ' → ' + fmt(t.min) + '</td></tr>'; }).join('')}</tbody></table>`;
    if (sel) chart(el.querySelector('#dmChart'), sel.r, sel.f);
    el.querySelectorAll('[data-i]').forEach((tr) => tr.addEventListener('click', () => { pick = B.ITEMS[+tr.dataset.i]; render(el); }));
    el.querySelector('#dmAuto').addEventListener('click', () => { B.demand.auto = !B.demand.auto; B.stock.compute(true); B.tools.toast(B.demand.auto ? 'Min and max now follow the demand forecast' : 'Back to the fixed min / max rule'); render(el); });
    el.querySelector('#dmCsv').addEventListener('click', () => {
      const head = ['Material no', 'Material', 'Class', 'Method', 'Accuracy %'].concat(Array.from({ length: H }, (_, i) => 'Week +' + (i + 1)));
      B.tools.download('building100-demand-forecast.csv', [head.join(',')].concat(fs.map(({ r, f }) => [r.it.mat, '"' + r.it.name + '"', r.abc + r.xyz, f.method, f.acc == null ? '' : Math.round(f.acc * 100)].concat(f.ahead.map((v) => v.toFixed(2))).join(','))).join('\n'));
    });
  }
  function chart(c, r, f) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), line = cs.getPropertyValue('--line').trim();
    const n = r.weeks.length + H, bw = 760 / n, max = Math.max(0.1, ...r.weeks, ...f.ahead.map((v) => v + 1.28 * f.sigma));
    const Y = (v) => 250 - (v / max) * 220, X = (i) => 60 + i * bw;
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '600 17px "IBM Plex Sans", sans-serif';
    r.weeks.forEach((v, i) => { ctx.fillStyle = line; ctx.fillRect(X(i) + 3, Y(v), bw - 6, 250 - Y(v)); });
    ctx.fillStyle = 'rgba(242,179,27,0.18)'; ctx.beginPath();
    f.ahead.forEach((v, i) => { const x = X(r.weeks.length + i) + bw / 2; i ? ctx.lineTo(x, Y(v + 1.28 * f.sigma)) : ctx.moveTo(x, Y(v + 1.28 * f.sigma)); });
    for (let i = H - 1; i >= 0; i--) ctx.lineTo(X(r.weeks.length + i) + bw / 2, Y(Math.max(0, f.ahead[i] - 1.28 * f.sigma)));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.beginPath();
    f.ahead.forEach((v, i) => { const x = X(r.weeks.length + i) + bw / 2; i ? ctx.lineTo(x, Y(v)) : ctx.moveTo(x, Y(v)); }); ctx.stroke();
    ctx.strokeStyle = muted; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(X(r.weeks.length), 20); ctx.lineTo(X(r.weeks.length), 250); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = muted; ctx.fillText('last 13 weeks', 60, 280); ctx.fillText('next 12 weeks', X(r.weeks.length) + 8, 280); ctx.fillText(r.it.unit + ' per week', 60, 18);
  }
  B.demand = { auto: false, forecast, adjust, of };
  B.tools.add({ id: 'demand', label: 'Demand', render });
})();
