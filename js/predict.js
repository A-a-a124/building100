/* Building 100 - look ahead: the twin runs the next 8 hours from today's exact state and warns what will happen, shown in the 3D view */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const H = 8, SEEDS = 12;
  // the day has a rhythm: most trucks and orders come mid-morning and after lunch
  const rhythm = (h) => { h = ((h % 24) + 24) % 24; return h >= 8 && h < 11 ? 1.6 : h >= 13 && h < 15 ? 1.3 : h >= 7 && h < 17 ? 0.85 : 0.7; };
  const baseFactor = B.env.rateFactor;
  B.env.rateFactor = () => baseFactor() * rhythm(((S.st.t / 3600) % 24 + 24) % 24);
  const shiftK = (h) => rhythm(h) * shiftBase(h);
  const shiftBase = (h) => { h = ((h % 24) + 24) % 24; const k = h >= 7 && h < 15 ? 1 : h >= 15 && h < 23 ? 0.8 : 0.3; const brk = (h >= 12 && h < 12.5) || (h >= 19 && h < 19.5) || (h >= 3 && h < 3.5); return k * (brk ? 0.5 : 1); };
  const clock = (t) => S.clock(t);

  // one possible future, starting from where every forklift, door and pallet is right now
  function run(seed, extraForklifts) {
    const R = B.rng(seed), t0 = S.st.t, end = t0 + H * 3600, rate = S.RATES[S.st.rate];
    const dust = B.weather && B.weather.state.dust ? B.weather.state.dust.until : 0;
    const exp = (per) => -Math.log(1 - R()) * 3600 / Math.max(0.01, per);
    const plan = B.slotting.plan(), occ = B.SLOTS.filter((s) => s.item >= 0), avgD = occ.reduce((n, s) => n + (plan.costs.get(s) || 90), 0) / Math.max(1, occ.length);
    const dur = (2 * avgD) / 2.8 + 8;
    const rowN = B.RACK.rows.map((_, i) => B.SLOTS.filter((s) => s.row === i && s.item >= 0).length), rowCap = B.RACK.bays * B.RACK.levels * 2;
    const hours = Array.from({ length: H }, () => ({ inP: 0, outP: 0, gate: 0, backlog: 0, busy: 0, orderWait: 0 }));
    const idx = (t) => Math.min(H - 1, Math.max(0, Math.floor((t - t0) / 3600)));
    const closed = B.whatif ? B.whatif.state.doors : new Set();
    const doorIn = W.doorsIn.filter((d) => !closed.has(d)).map((d) => { const tr = S.trucks.find((q) => q.door === d); return tr ? t0 + (tr.count ? Math.max(0, tr.count - (tr.done || 0)) * 120 + 60 : 300) : t0; });
    const doorOut = W.doorsOut.filter((d) => !closed.has(d)).map((d) => { const o = S.orders.find((q) => q.door === d); return o ? t0 + 1500 : t0; });
    const tasks = [];
    for (let i = 0; i < S.tasks.length; i++) tasks.push({ rel: t0, kind: 'now' });
    const trucks = [], pick = (arr) => { let k = 0; for (let i = 1; i < arr.length; i++) if (arr[i] < arr[k]) k = i; return k; };
    // inbound trucks: wait for a door, then 5 minutes plus 2 minutes a pallet; pallets become put-away tasks
    (S.gate || []).forEach(() => trucks.push({ t: t0, n: 9 }));
    for (let t = t0 + exp(rate.trucks); t < end; ) {
      trucks.push({ t, n: 6 + Math.floor(R() * 7) });
      t += exp(Math.max(0.1, rate.trucks * shiftK(t / 3600) * (t < dust ? 0.6 : 1)));
    }
    trucks.sort((a, b) => a.t - b.t);
    trucks.forEach((tr) => {
      const k = pick(doorIn), start = Math.max(tr.t, doorIn[k]);
      tr.start = start; doorIn[k] = start + 300 + tr.n * 120;
      for (let p = 0; p < tr.n; p++) { tasks.push({ rel: start + 300 + p * 120, kind: 'in' }); if (start + p * 120 < end) { hours[idx(start)].inP++; const cand = Math.floor(R() * rowN.length); rowN[cand]++; } }
      for (let h = 0; h < H; h++) { const m = t0 + (h + 0.5) * 3600; if (tr.t <= m && start > m) hours[h].gate++; }
    });
    // issue orders: checked, wait for a door, picked, truck called, loaded
    for (let t = t0 + exp(rate.orders); t < end; ) {
      const lines = 2 + Math.floor(R() * 5), k = pick(doorOut), ready = t + (8 + R() * 12) * 60, start = Math.max(ready, doorOut[k]);
      doorOut[k] = start + (lines * dur) / 2 + 17 * 60 + 300 + lines * 120;
      for (let p = 0; p < lines; p++) { tasks.push({ rel: start, kind: 'out' }); hours[idx(start)].outP++; const cand = Math.floor(R() * rowN.length); rowN[cand] = Math.max(0, rowN[cand] - 1); }
      hours[idx(t)].orderWait = Math.max(hours[idx(t)].orderWait, (start - ready) / 60);
      t += exp(Math.max(0.1, rate.orders * shiftK(t / 3600)));
    }
    tasks.sort((a, b) => a.rel - b.rel);
    // forklifts serve the tasks; each has its battery and any repair still to come
    const fl = S.forklifts.map((f) => ({ free: f.down ? f.down.until : f.phase === 'charging' ? t0 + ((90 - (f.battery || 50)) / 32) * 3600 : t0, bat: f.battery == null ? 80 : f.battery }));
    for (let e = 0; e < (extraForklifts || 0); e++) fl.push({ free: t0, bat: 95 });
    const charges = [];
    tasks.forEach((k) => {
      let i = 0; for (let q = 1; q < fl.length; q++) if (fl[q].free < fl[i].free) i = q;
      const f = fl[i], start = Math.max(k.rel, f.free);
      f.free = start + dur; f.bat -= (dur / 3600) * 14;
      if (start < end) hours[idx(start)].busy += dur;
      for (let h = 0; h < H; h++) { const m = t0 + (h + 1) * 3600; if (k.rel <= m && start > m) hours[h].backlog++; }
      if (f.bat < 20) { f.free += (70 / 32) * 3600; f.bat = 90; if (f.free < end) charges.push({ t: f.free - (70 / 32) * 3600, n: S.forklifts[i] ? S.forklifts[i].n : 0 }); }
    });
    hours.forEach((h) => (h.util = h.busy / (fl.length * 3600)));
    return { hours, rowN, charges, rowCap };
  }
  function forecast(extra) {
    const runs = Array.from({ length: SEEDS }, (_, s) => run(1000 + s * 37, extra)), t0 = S.st.t, occ0 = B.occupiedCount();
    const hours = Array.from({ length: H }, (_, h) => { const av = (k) => runs.reduce((n, r) => n + r.hours[h][k], 0) / SEEDS; return { t: t0 + h * 3600, inP: av('inP'), outP: av('outP'), gate: av('gate'), backlog: av('backlog'), util: av('util'), orderWait: av('orderWait') }; });
    let occ = occ0; hours.forEach((q) => { occ += q.inP - q.outP; q.occ = occ / B.SLOTS.length; });
    const rowFill = B.RACK.rows.map((_, i) => runs.reduce((n, r) => n + r.rowN[i] / r.rowCap, 0) / SEEDS);
    return { t0, hours, rowFill, charges: runs[0].charges };
  }
  function events(fc) {
    const out = [];
    const q = fc.hours.find((h) => h.gate >= 0.25);
    if (q) out.push({ level: 'warn', t: q.t, text: clock(q.t) + ': trucks start queuing at the gate' + (q.gate >= 1 ? ', about ' + fmt(q.gate, 0) + ' waiting' : ''), act: 'gate' });
    const peak = fc.hours.reduce((m, h) => (h.backlog > m.backlog ? h : m), fc.hours[0]);
    if (peak.backlog >= 6) out.push({ level: 'warn', t: peak.t, text: clock(peak.t) + ': pallet moves pile up, about ' + fmt(peak.backlog, 0) + ' waiting for a forklift', act: 'fleet' });
    const hot = fc.hours.find((h) => h.util > 0.75);
    if (hot) out.push({ level: 'warn', t: hot.t, text: clock(hot.t) + ': forklifts near their limit, ' + fmt(hot.util * 100, 0) + '% busy', act: 'fleet' });
    const busy = fc.hours.reduce((m, h) => (h.inP + h.outP > m.inP + m.outP ? h : m), fc.hours[0]);
    out.push({ level: 'info', t: busy.t, text: clock(busy.t) + ': busiest hour ahead, about ' + fmt(busy.inP + busy.outP, 0) + ' pallet moves with forklifts ' + fmt(busy.util * 100, 0) + '% busy', act: 'fleet' });
    const top = fc.rowFill.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)[0];
    if (top.v < 0.92) out.push({ level: 'info', t: fc.t0 + H * 3600, text: 'Row ' + B.RACK.rows[top.i].letter + ' will be the fullest, at ' + fmt(top.v * 100, 0) + '%', act: 'row', row: top.i });
    const wait = fc.hours.find((h) => h.orderWait > 15);
    if (wait) out.push({ level: 'warn', t: wait.t, text: clock(wait.t) + ': issue orders wait ' + fmt(wait.orderWait, 0) + ' min for a shipping door', act: 'dsp' });
    fc.rowFill.forEach((v, i) => { if (v >= 0.92) out.push({ level: v >= 0.97 ? 'bad' : 'warn', t: fc.t0 + H * 3600, text: 'Row ' + B.RACK.rows[i].letter + ' reaches ' + fmt(Math.min(100, v * 100), 0) + '% within 8 hours', act: 'row', row: i }); });
    fc.charges.slice(0, 2).forEach((c) => out.push({ level: 'info', t: c.t, text: clock(c.t) + ': forklift ' + c.n + ' will need its charger', act: 'fleet' }));
    if (!out.some((e) => e.level !== 'info')) out.unshift({ level: 'good', t: fc.t0 - 1, text: 'No queues or overloads expected in the next 8 hours', act: '' });
    return out.sort((a, b) => a.t - b.t);
  }

  // ---------- warnings placed in the 3D view ----------
  const ghost = new T.Group(); ghost.visible = false; W.scene.add(ghost);
  const rowMat = new T.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
  const truckMat = new T.MeshBasicMaterial({ color: '#58d0ff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
  function drawGhost(fc, h) {
    while (ghost.children.length) ghost.remove(ghost.children[0]);
    const hr = fc.hours[h], frac = (h + 1) / H, R0 = B.RACK;
    const order = fc.rowFill.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v), top1 = order[0].i, top2 = order[1].i;
    fc.rowFill.forEach((end, i) => {
      const now = B.SLOTS.filter((s) => s.row === i && s.item >= 0).length / (R0.bays * R0.levels * 2), v = now + (end - now) * frac;
      if (i !== top1 && i !== top2) return;
      const row = R0.rows[i], m = new T.Mesh(new T.BoxGeometry(R0.bays * R0.bayW, R0.levels * R0.levelH + 0.6, R0.depth + 0.5), rowMat);
      m.position.set(R0.x0 + (R0.bays * R0.bayW) / 2, (R0.levels * R0.levelH + 0.6) / 2, row.z); ghost.add(m);
      const l = W.makeLabel('Row ' + row.letter + ' · ' + Math.round(v * 100) + '%', { size: 1, bg: 'rgba(200,90,10,0.95)', weight: 700 }); l.position.set(R0.x0 - 2, 10.6, row.z); ghost.add(l);
    });
    const door = W.doorsIn[0], n = Math.round(hr.gate);
    for (let k = 0; k < Math.min(5, n); k++) { const m = new T.Mesh(new T.BoxGeometry(2.5, 3.2, 15), truckMat); m.position.set(door.x - 9, 1.7, B.BUILDING.z0 - 16 - k * 17); ghost.add(m); }
    if (n) { const l = W.makeLabel(n + ' truck' + (n > 1 ? 's' : '') + ' waiting at ' + clock(hr.t), { size: 1.2, bg: 'rgba(16,80,120,0.95)', weight: 700 }); l.position.set(door.x - 9, 6, B.BUILDING.z0 - 16); ghost.add(l); }
  }

  // ---------- compare with what really happens ----------
  let saved = null, last = null, lastT = -1e9;
  const actual = [];
  B.hooks.frame.push(() => {
    if (saved && S.st.t - (actual.length ? actual[actual.length - 1].t : saved.t0 - 3600) >= 3600 && actual.length < H) actual.push({ t: saved.t0 + actual.length * 3600 + 3600, occ: B.occupiedCount() / B.SLOTS.length });
  });
  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => {
    if (S.st.t - lastT > 1800 || !last) { last = forecast(); lastT = S.st.t; }
    const e = events(last).find((q) => q.level === 'warn' || q.level === 'bad');
    return e ? [{ key: 'pred' + e.text, level: 'info', text: 'Forecast: ' + e.text, sub: 'The twin ran the next 8 hours from the current state.', act: 'Look ahead', go: () => B.tools.open('predict') }] : [];
  });

  let hourSel = 0;
  function render(el) {
    const fc = (last = forecast()), ev = events(fc), plus = forecast(1); lastT = S.st.t;
    if (!saved) saved = { t0: fc.t0, hours: fc.hours };
    const gain = fc.hours.reduce((n, h) => n + h.backlog, 0) - plus.hours.reduce((n, h) => n + h.backlog, 0);
    el.innerHTML = `<h4>Look ahead: the next 8 hours</h4><p>This is what makes it a twin and not a 3D drawing. It starts from the exact state of the warehouse right now and runs the coming hours ${SEEDS} times in a moment, so you see trouble before it happens.</p>
      <div class="pdEv">${ev.map((e) => '<div class="alert ' + (e.level === 'good' ? 'info' : e.level) + '"><i></i><div><b>' + P.esc(e.text) + '</b></div>' + (e.act === 'gate' ? '<button class="chip" data-go="gate">Show</button>' : e.act === 'fleet' ? '<button class="chip" data-go="fleet">Fleet</button>' : e.act === 'dsp' ? '<button class="chip" data-go="dsp">Show</button>' : e.act === 'row' ? '<button class="chip" data-row="' + e.row + '">Show</button>' : '<span></span>') + '</div>').join('')}</div>
      <canvas id="pdC" width="840" height="320"></canvas>
      <label class="f">See it in 3D at <b id="pdH">${clock(fc.hours[hourSel].t)}</b><input type="range" id="pdS" min="0" max="${H - 1}" value="${hourSel}"></label>
      <div class="row2"><div class="stat"><b id="pdA">-</b><small>pallets moved in that hour</small></div><div class="stat"><b id="pdB">-</b><small>waiting for a forklift</small></div><div class="stat"><b id="pdD">-</b><small>trucks waiting at the gate</small></div><div class="stat"><b id="pdU">-</b><small>forklifts busy</small></div></div>
      <div class="card"><b>What if we add one forklift now?</b><p>${gain > 0.5 ? 'About ' + fmt(gain, 0) + ' fewer pallet-hours waiting over the next 8 hours.' : 'Little change: forklifts are not the limit in this period.'} Use What if or Best setup to test other changes.</p></div>
      <h4>Was the twin right?</h4><p id="pdChk"></p>
      <div class="btnrow"><button class="btn" id="pdNew">Run it again from now</button><button class="btn" id="pdGhost">${ghost.visible ? 'Hide' : 'Show'} warnings in 3D</button></div>`;
    const q = (id) => el.querySelector('#' + id);
    const pick = () => { const h = fc.hours[hourSel]; q('pdH').textContent = clock(h.t); q('pdA').textContent = fmt(h.inP + h.outP, 0); q('pdB').textContent = fmt(h.backlog, 0); q('pdD').textContent = fmt(h.gate, 1); q('pdU').textContent = fmt(h.util * 100, 0) + '%'; drawGhost(fc, hourSel); chart(q('pdC'), fc); };
    q('pdS').addEventListener('input', (e) => { hourSel = +e.target.value; ghost.visible = true; q('pdGhost').textContent = 'Hide warnings in 3D'; pick(); });
    q('pdGhost').addEventListener('click', () => { ghost.visible = !ghost.visible; q('pdGhost').textContent = (ghost.visible ? 'Hide' : 'Show') + ' warnings in 3D'; });
    q('pdNew').addEventListener('click', () => { saved = null; actual.length = 0; render(el); });
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const g = b.dataset.go; if (g === 'fleet') return B.tools.open('fleet'); ghost.visible = true; if (g === 'gate') B.ui.flyTo([-110, 34, -115], [-60, 0, -62], 1.3); else B.ui.focusZone('DSP'); }));
    el.querySelectorAll('[data-row]').forEach((b) => b.addEventListener('click', () => { ghost.visible = true; const s = B.SLOTS.find((x) => x.row === +b.dataset.row && x.bay === 12); B.ui.focusSlot(s); }));
    const c = actual.slice(0, saved.hours.length).map((a, i) => Math.abs(a.occ - saved.hours[i].occ) * 100);
    q('pdChk').textContent = c.length ? 'After ' + c.length + ' simulated hours, rack occupancy is within ' + fmt(c.reduce((a, b) => a + b, 0) / c.length, 1) + ' points of the forecast.' : 'Let the simulation run: as hours pass, the real occupancy is compared with this forecast.';
    pick();
  }
  function chart(c, fc) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement), muted = cs.getPropertyValue('--muted').trim(), acc = cs.getPropertyValue('--accent-strong').trim(), bad = cs.getPropertyValue('--bad').trim();
    const hs = fc.hours, max = Math.max(1, ...hs.map((h) => h.inP + h.outP), ...hs.map((h) => h.backlog)), bw = 760 / H, Y = (v) => 270 - (v / max) * 230;
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '600 17px "IBM Plex Sans", sans-serif';
    hs.forEach((h, i) => {
      const x = 60 + i * bw;
      if (i === hourSel) { ctx.fillStyle = 'rgba(88,208,255,0.15)'; ctx.fillRect(x, 30, bw, 240); }
      ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x + 8, Y(h.inP), bw / 2 - 10, 270 - Y(h.inP));
      ctx.fillStyle = acc; ctx.fillRect(x + bw / 2 + 2, Y(h.outP), bw / 2 - 10, 270 - Y(h.outP));
      ctx.fillStyle = muted; ctx.fillText(clock(h.t), x + 12, 298);
      if (h.gate >= 0.6) { ctx.fillStyle = bad; ctx.fillText('▲', x + bw / 2 - 8, 26); }
    });
    ctx.strokeStyle = bad; ctx.lineWidth = 4; ctx.beginPath(); hs.forEach((h, i) => { const x = 60 + (i + 0.5) * bw; i ? ctx.lineTo(x, Y(h.backlog)) : ctx.moveTo(x, Y(h.backlog)); }); ctx.stroke();
    ctx.fillStyle = '#3a7bd5'; ctx.fillText('received', 60, 318); ctx.fillStyle = acc; ctx.fillText('issued', 150, 318); ctx.fillStyle = bad; ctx.fillText('waiting for a forklift   ▲ gate queue', 220, 318);
  }
  B.tools.add({ id: 'predict', label: 'Look ahead', render });
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vPredict" title="Run the next 8 hours from the current state">Look ahead</button>');
  document.getElementById('vPredict').addEventListener('click', () => { ghost.visible = true; B.tools.open('predict'); });
  B.predict = { forecast, events, ghost };
})();
