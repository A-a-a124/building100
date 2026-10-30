/* Building 100 - fast analytical model: compare two scenarios side by side, export the report, forecast when racks fill */
(function () {
  const B = window.B100, S = B.sim, L = B.LANES, W = B.world;
  const fmt = (n, d) => B.tools.fmt(n, d);

  // driving distance from an inbound door to a slot, for put-away
  function costIn(s) {
    let best = Infinity;
    for (const d of W.doorsIn) for (const xc of [L.west, L.east]) best = Math.min(best, Math.abs(s.x - xc) + Math.abs(s.access - L.front) + Math.abs(xc - d.x) + 6);
    return best + (s.level - 1) * 11.7;
  }

  // queue model: tasks arrive over the shift, forklifts serve them first come first served
  function run(cfg, seed) {
    const R = B.rng(seed), rate = S.RATES[cfg.rate], H = cfg.hours * 3600, plan = B.slotting.plan();
    const occ = B.SLOTS.filter((s) => s.item >= 0), empty = B.SLOTS.filter((s) => s.item < 0);
    const pool = occ.map((s) => ({ c: cfg.slotting === 'optimized' ? plan.costs.get(plan.ideal.get(s)) : plan.costs.get(s), w: B.slotting.velocity(s) }));
    const cum = []; let acc = 0; pool.forEach((p) => cum.push((acc += p.w)));
    const pickCost = () => { const r = R() * acc; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return pool[lo].c; };
    const putCost = () => costIn(empty.length ? empty[Math.floor(R() * empty.length)] : occ[Math.floor(R() * occ.length)]);
    const exp = (perHour) => -Math.log(1 - R()) * 3600 / perHour;
    const tasks = [], orders = [];
    for (let t = exp(rate.trucks); t < H; t += exp(rate.trucks)) { const n = 6 + Math.floor(R() * 7); for (let k = 0; k < n; k++) tasks.push({ rel: t + 10 + k * 20, d: putCost() }); }
    for (let t = exp(rate.orders); t < H; t += exp(rate.orders)) {
      const o = { t, lines: 2 + Math.floor(R() * 5), done: 0 };
      orders.push(o);
      for (let k = 0; k < o.lines; k++) tasks.push({ rel: t, d: pickCost(), o });
    }
    tasks.sort((a, b) => a.rel - b.rel);
    const free = new Array(cfg.forklifts).fill(0);
    let busy = 0, km = 0, waitSum = 0, waitMax = 0;
    tasks.forEach((k) => {
      let f = 0; for (let i = 1; i < free.length; i++) if (free[i] < free[f]) f = i;
      const start = Math.max(k.rel, free[f]), dur = (2 * k.d) / 2.8 + 8;
      free[f] = start + dur; busy += dur; km += (2 * k.d) / 1000;
      const w = start - k.rel; waitSum += w; waitMax = Math.max(waitMax, w);
      if (k.o) k.o.done = Math.max(k.o.done, start + dur);
    });
    const shipped = orders.filter((o) => o.done && o.done < H);
    const cycle = shipped.reduce((n, o) => n + (o.done - o.t + o.lines * 15 + 10), 0) / Math.max(1, shipped.length) / 60;
    return { cycle, util: busy / (cfg.forklifts * H), waitAvg: waitSum / Math.max(1, tasks.length) / 60, waitMax: waitMax / 60, km, tasks: tasks.length, orders: orders.length };
  }
  function simulate(cfg) {
    const runs = [11, 23, 37, 51, 73].map((s) => run(cfg, s));
    const avg = (k) => runs.reduce((n, r) => n + r[k], 0) / runs.length;
    return { cycle: avg('cycle'), util: avg('util'), waitAvg: avg('waitAvg'), waitMax: avg('waitMax'), km: avg('km'), tasks: avg('tasks'), orders: avg('orders') };
  }

  // ---------- Compare tab ----------
  let A = null, Bc = null, last = null;
  const sel = (id, opts, v) => '<select id="' + id + '">' + opts.map(([val, lab]) => '<option value="' + val + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + lab + '</option>').join('') + '</select>';
  function cfgForm(tag, c) {
    return `<div style="display:grid;gap:8px"><h4>Scenario ${tag}</h4>
      <label class="f">Forklifts${sel('f' + tag, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, n]), c.forklifts)}</label>
      <label class="f">Workload${sel('w' + tag, [['low', 'Low'], ['base', 'Normal'], ['high', 'High']], c.rate)}</label>
      <label class="f">Slotting${sel('s' + tag, [['current', 'Current'], ['optimized', 'Optimised']], c.slotting)}</label>
      <label class="f">Shift length${sel('h' + tag, [[8, '8 hours'], [12, '12 hours'], [24, '24 hours']], c.hours)}</label></div>`;
  }
  const ROWS = [['Order cycle time', 'cycle', 'min', 1, true], ['Forklift utilisation', 'util', '%', 0, null], ['Average wait for a forklift', 'waitAvg', 'min', 1, true],
    ['Longest wait', 'waitMax', 'min', 1, true], ['Driving distance', 'km', 'km', 1, true], ['Pallet moves', 'tasks', '', 0, null], ['Issue orders', 'orders', '', 0, null]];
  const val = (r, k) => (k === 'util' ? r[k] * 100 : r[k]);
  function renderCompare(el) {
    A = A || { forklifts: S.targetForklifts, rate: S.st.rate, slotting: 'current', hours: 8 };
    Bc = Bc || { forklifts: S.targetForklifts, rate: S.st.rate, slotting: 'optimized', hours: 8 };
    el.innerHTML = `<h4>Compare two scenarios</h4><p>A fast queue model of the same layout: trucks and orders arrive at random, forklifts serve them in turn. Each result is the average of 5 runs.</p>
      <div class="row2">${cfgForm('A', A)}${cfgForm('B', Bc)}</div>
      <div class="btnrow"><button class="btn primary" id="cmpRun">Run comparison</button></div><div id="cmpOut"></div>`;
    el.querySelector('#cmpRun').addEventListener('click', () => {
      const read = (t) => ({ forklifts: +el.querySelector('#f' + t).value, rate: el.querySelector('#w' + t).value, slotting: el.querySelector('#s' + t).value, hours: +el.querySelector('#h' + t).value });
      A = read('A'); Bc = read('B');
      last = { A, B: Bc, ra: simulate(A), rb: simulate(Bc), at: new Date() };
      showResult(el.querySelector('#cmpOut'));
    });
    if (last) showResult(el.querySelector('#cmpOut'));
  }
  function showResult(out) {
    const { ra, rb } = last;
    out.innerHTML = `<table><thead><tr><th>Measure</th><th class="num">A</th><th class="num">B</th><th class="num">Change</th></tr></thead><tbody>${ROWS.map(([n, k, u, d, lowerBetter]) => {
      const a = val(ra, k), b = val(rb, k), ch = a ? ((b - a) / a) * 100 : 0, cls = lowerBetter == null || Math.abs(ch) < 0.5 ? '' : (ch < 0) === lowerBetter ? 'good' : 'bad';
      return `<tr><td>${n}</td><td class="num">${fmt(a, d)} ${u}</td><td class="num">${fmt(b, d)} ${u}</td><td class="num ${cls}">${ch > 0 ? '+' : ''}${fmt(ch, 1)}%</td></tr>`;
    }).join('')}</tbody></table>
      <canvas id="cmpChart" width="840" height="300"></canvas>
      <div class="btnrow"><button class="btn" id="cmpCsv">Export to Excel (CSV)</button><button class="btn" id="cmpPdf">Print or save as PDF</button></div>`;
    drawBars(out.querySelector('#cmpChart'), ra, rb);
    out.querySelector('#cmpCsv').addEventListener('click', exportCsv);
    out.querySelector('#cmpPdf').addEventListener('click', printReport);
  }
  function drawBars(c, ra, rb) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim(), muted = cs.getPropertyValue('--muted').trim(), acc = cs.getPropertyValue('--accent-strong').trim();
    const items = [['Cycle time (min)', ra.cycle, rb.cycle], ['Utilisation (%)', ra.util * 100, rb.util * 100], ['Avg wait (min)', ra.waitAvg, rb.waitAvg]];
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '600 22px "IBM Plex Sans", sans-serif';
    items.forEach(([lab, a, b], i) => {
      const x0 = 30 + i * 270, max = Math.max(a, b, 0.001), H = 190;
      [[a, muted, 'A'], [b, acc, 'B']].forEach(([v, col, t], j) => {
        const h = (v / max) * H, x = x0 + j * 100;
        ctx.fillStyle = col; ctx.fillRect(x, 240 - h, 80, h);
        ctx.fillStyle = ink; ctx.fillText(t + ' ' + fmt(v, 1), x, 232 - h);
      });
      ctx.fillStyle = muted; ctx.fillText(lab, x0, 280);
    });
  }
  function exportCsv() {
    const { A: a, B: b, ra, rb } = last;
    const lines = ['Building 100 scenario comparison,' + last.at.toISOString(), 'Setting,Scenario A,Scenario B',
      'Forklifts,' + a.forklifts + ',' + b.forklifts, 'Workload,' + a.rate + ',' + b.rate, 'Slotting,' + a.slotting + ',' + b.slotting, 'Shift hours,' + a.hours + ',' + b.hours, '',
      'Measure,Scenario A,Scenario B,Change %'].concat(ROWS.map(([n, k, u, d]) => { const x = val(ra, k), y = val(rb, k); return n + (u ? ' (' + u + ')' : '') + ',' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + (x ? (((y - x) / x) * 100).toFixed(1) : '0'); }));
    B.tools.download('building100-scenarios.csv', lines.join('\n'));
  }
  function printReport() {
    let r = document.getElementById('printReport');
    if (!r) { r = document.createElement('div'); r.id = 'printReport'; r.style.display = 'none'; document.body.appendChild(r); }
    const { A: a, B: b } = last;
    r.innerHTML = '<h1>Building 100 &middot; Scenario comparison</h1><p>' + last.at.toLocaleString('en-GB') + '</p><p>A: ' + a.forklifts + ' forklifts, ' + a.rate + ' workload, ' + a.slotting + ' slotting, ' + a.hours + ' h. B: ' + b.forklifts + ' forklifts, ' + b.rate + ' workload, ' + b.slotting + ' slotting, ' + b.hours + ' h.</p>' + document.querySelector('#cmpOut table').outerHTML;
    r.style.display = 'block';
    try { window.print(); } catch (e) {}
    setTimeout(() => (r.style.display = 'none'), 500);
  }

  // ---------- Forecast tab ----------
  function renderForecast(el) {
    const rate = S.RATES[S.st.rate], hrs = 16;
    const outDef = Math.round(rate.orders * 4 * hrs), inDef = Math.round(outDef * 1.05);
    el.innerHTML = `<h4>When will the racks fill?</h4><p>Projects rack occupancy week by week from daily receipts and issues. Issues start from the current workload and receipts 5% above that; enter your real daily figures for a true forecast.</p>
      <div class="row2"><label class="f">Pallets received per day<input type="number" id="fcIn" value="${inDef}" min="0"></label><label class="f">Pallets issued per day<input type="number" id="fcOut" value="${outDef}" min="0"></label>
      <label class="f">Working days per week<input type="number" id="fcDays" value="6" min="1" max="7"></label><label class="f">Weeks to show<input type="number" id="fcWeeks" value="26" min="4" max="104"></label></div>
      <canvas id="fcChart" width="840" height="360"></canvas><div id="fcText"></div>`;
    const go = () => draw(el);
    el.querySelectorAll('input').forEach((i) => i.addEventListener('input', go));
    go();
  }
  function draw(el) {
    const cap = B.SLOTS.length, now = B.occupiedCount();
    const net = (+el.querySelector('#fcIn').value || 0) - (+el.querySelector('#fcOut').value || 0);
    const days = +el.querySelector('#fcDays').value || 6, weeks = +el.querySelector('#fcWeeks').value || 26;
    const pts = []; for (let w = 0; w <= weeks; w++) pts.push(Math.max(0, Math.min(cap, now + net * days * w)) / cap);
    const c = el.querySelector('#fcChart'), ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), bad = cs.getPropertyValue('--bad').trim(), line = cs.getPropertyValue('--line').trim();
    ctx.clearRect(0, 0, c.width, c.height);
    const X = (w) => 60 + (w / weeks) * 750, Y = (v) => 320 - v * 290;
    ctx.font = '20px "IBM Plex Sans", sans-serif'; ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(60, Y(v)); ctx.lineTo(810, Y(v)); ctx.stroke(); ctx.fillStyle = muted; ctx.fillText(v * 100 + '%', 6, Y(v) + 6); });
    ctx.strokeStyle = bad; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(60, Y(0.95)); ctx.lineTo(810, Y(0.95)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = bad; ctx.fillText('95% full', 700, Y(0.95) - 8);
    ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.beginPath(); pts.forEach((v, w) => (w ? ctx.lineTo(X(w), Y(v)) : ctx.moveTo(X(w), Y(v)))); ctx.stroke();
    ctx.fillStyle = muted; ctx.fillText('Week 0', 60, 350); ctx.fillText('Week ' + weeks, 730, 350);
    let msg;
    if (net <= 0) msg = net === 0 ? 'Receipts and issues balance: occupancy stays at ' + fmt((now / cap) * 100, 1) + '%.' : 'Stock shrinks by ' + fmt(-net) + ' pallets a day: the racks will not fill.';
    else {
      const daysTo95 = Math.max(0, (0.95 * cap - now) / net), weeksTo95 = daysTo95 / days;
      const when = new Date(Date.now() + weeksTo95 * 7 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      msg = 'At +' + fmt(net) + ' pallets a day the racks reach 95% in about <b>' + fmt(weeksTo95, 1) + ' weeks</b> (around ' + when + '). Plan disposals of stagnant stock or extra storage before then.';
    }
    el.querySelector('#fcText').innerHTML = '<p>' + msg + '</p>';
  }

  B.tools.add({ id: 'compare', label: 'Compare', render: renderCompare });
  B.tools.add({ id: 'forecast', label: 'Forecast', render: renderForecast });
  B.analysis = { simulate };
})();
