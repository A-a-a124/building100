/* Building 100 - replay a real day: load the actual receipts and issues, run them through the model and in 3D, compare with what happened */
(function () {
  const B = window.B100, S = B.sim, P = B.panel, L = B.LANES, W = B.world;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const COLS = {
    time: ['time', 'created', 'created at', 'date', 'timestamp', 'start', 'start time', 'entry time'],
    type: ['type', 'movement', 'direction', 'kind', 'movement type', 'transaction'],
    qty: ['pallets', 'lines', 'qty', 'quantity', 'items', 'pallet count'],
    actual: ['actual minutes', 'actual cycle', 'cycle time', 'minutes', 'duration', 'actual', 'actual cycle time'],
  };
  let day = null, result = null;

  function toSec(v) {
    if (v instanceof Date) return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== '') return n < 1 ? Math.round(n * 86400) : n % 1 ? Math.round((n % 1) * 86400) : n < 25 ? n * 3600 : NaN;
    const m = String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return NaN;
    let hh = +m[1]; if (m[4] && /pm/i.test(m[4]) && hh < 12) hh += 12; if (m[4] && /am/i.test(m[4]) && hh === 12) hh = 0;
    return hh * 3600 + +m[2] * 60 + (+m[3] || 0);
  }
  const kindOf = (v) => (/issue|order|out|ship|dispatch|\bgi\b|201|261/i.test(v) ? 'out' : /rec|in|\bgr\b|101|deliver/i.test(v) ? 'in' : null);
  function parse(rows, label) {
    const h = rows[0].map((x) => String(x).trim().toLowerCase()), c = {};
    for (const k in COLS) c[k] = h.findIndex((x) => COLS[k].includes(x));
    if (c.time < 0 || c.type < 0) throw new Error('The file needs a "Time" and a "Type" column (Receipt or Issue). Use the template.');
    const ev = rows.slice(1).map((r) => ({ t: toSec(r[c.time]), kind: kindOf(String(r[c.type])), n: c.qty >= 0 ? Math.max(1, Math.round(Number(r[c.qty]) || 1)) : 1, actual: c.actual >= 0 ? Number(r[c.actual]) || null : null }))
      .filter((e) => !isNaN(e.t) && e.kind).sort((a, b) => a.t - b.t);
    if (!ev.length) throw new Error('No rows with a readable time and type were found.');
    return { label, ev, ins: ev.filter((e) => e.kind === 'in'), outs: ev.filter((e) => e.kind === 'out') };
  }

  // same queue model as the Compare tab, but fed with the real arrivals
  function model(d, forklifts) {
    const plan = B.slotting.plan(), occ = B.SLOTS.filter((s) => s.item >= 0), R = B.rng(7);
    const pick = () => plan.costs.get(occ[Math.floor(R() * occ.length)]) || 60;
    const tasks = [], orders = [];
    d.ev.forEach((e) => {
      if (e.kind === 'in') for (let k = 0; k < e.n; k++) tasks.push({ rel: e.t + 10 + k * 20, d: pick() });
      else { const o = { t: e.t, lines: Math.min(6, e.n), done: 0, actual: e.actual }; orders.push(o); for (let k = 0; k < o.lines; k++) tasks.push({ rel: e.t, d: pick(), o }); }
    });
    tasks.sort((a, b) => a.rel - b.rel);
    const free = new Array(forklifts).fill(d.ev[0].t), backlog = new Array(24).fill(0);
    let busy = 0, waitMax = 0;
    tasks.forEach((k) => {
      let f = 0; for (let i = 1; i < free.length; i++) if (free[i] < free[f]) f = i;
      const start = Math.max(k.rel, free[f]), dur = (2 * k.d) / 2.8 + 8;
      free[f] = start + dur; busy += dur; waitMax = Math.max(waitMax, start - k.rel);
      for (let hh = Math.ceil(k.rel / 3600); hh * 3600 < start && hh < 24; hh++) backlog[hh]++;
      if (k.o) k.o.done = Math.max(k.o.done, start + dur);
    });
    const span = Math.max(3600, Math.max(...free) - d.ev[0].t);
    const cyc = orders.map((o) => (o.done - o.t + o.lines * 15 + 10) / 60);
    return { cycle: cyc.reduce((a, b) => a + b, 0) / Math.max(1, cyc.length), util: busy / (forklifts * span), waitMax: waitMax / 60, backlog, end: Math.max(...free), orders };
  }
  function analyse() {
    const n = S.targetForklifts;
    result = { at: n, runs: [n - 1, n, n + 1].filter((k) => k >= 1).map((k) => ({ k, r: model(day, k) })) };
    const act = day.outs.filter((e) => e.actual != null);
    result.actual = act.length ? act.reduce((a, e) => a + e.actual, 0) / act.length : null;
    result.hourly = new Array(24).fill(0).map((_, hh) => ({ in: day.ins.filter((e) => Math.floor(e.t / 3600) === hh).reduce((a, e) => a + e.n, 0), out: day.outs.filter((e) => Math.floor(e.t / 3600) === hh).reduce((a, e) => a + Math.min(6, e.n), 0) }));
  }

  // ---------- play the day in 3D ----------
  function play() {
    const now = S.st.t, base = Math.floor(now / 86400) * 86400 + (day.ev[0].t - 60 > now % 86400 ? 0 : 86400);
    S.st.t = base + day.ev[0].t - 60;
    const ev = day.ev.map((e) => ({ t: base + e.t, kind: e.kind, n: e.n, done: false }));
    S.resetStats();
    S.replay = {
      ev, base, total: ev.length, fired: 0,
      tick(t) {
        for (const e of ev) {
          if (e.done || e.t > t) continue;
          if (e.kind === 'in') { if (!S.newInbound(e.n)) continue; } else S.newOrder(e.n);
          e.done = true; this.fired++;
        }
        if (this.fired === this.total && !S.tasks.length && !S.pendingOrders.length && !S.trucks.length) finish();
      },
    };
    S.st.running = true;
    const sp = document.querySelector('#speed [data-v="20"]'); if (sp) sp.click(); else S.st.speed = 20;
    B.tools.toast('Replaying ' + day.label + ' at 20x: ' + ev.length + ' events from ' + S.clock(day.ev[0].t));
    B.ui.setView('overview');
    B.tools.refresh();
  }
  function finish() {
    const k = S.kpis();
    result = result || {};
    result.live = { cycle: k.cycle, util: k.util, received: k.received, shipped: k.shipped, clock: k.clock };
    S.replay = null;
    S.addLog('Replay of the real day finished at ' + k.clock, 'info');
    B.tools.toast('Replay finished: simulated cycle time ' + (k.cycle ? fmt(k.cycle, 1) + ' min' : 'n/a'), 6000);
    B.tools.refresh();
  }

  function template() {
    const R = B.rng(42), rows = ['Time,Type,Pallets,Actual minutes'];
    for (let t = 6.5 * 3600; t < 15 * 3600; t += 600 + R() * 1500) {
      const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), tm = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (R() < 0.42) rows.push(tm + ',Receipt,' + (5 + Math.floor(R() * 8)) + ',');
      else rows.push(tm + ',Issue,' + (1 + Math.floor(R() * 6)) + ',' + Math.round(18 + R() * 40));
    }
    return rows.join('\n');
  }

  function render(el) {
    const live = S.replay;
    el.innerHTML = `<h4>Replay a real day</h4><p>Load the receipts and issue orders of one real working day (export from SAP or your WMS). The model runs exactly that day: first instantly, to compare with what really happened, then live in 3D if you want to watch it.</p>
      <label class="drop" id="rpDrop" tabindex="0">Drop the day's .csv or .xlsx here, or click to choose<input type="file" id="rpFile" accept=".csv,.xlsx,.xls" hidden></label>
      <p>Columns: Time, Type (Receipt or Issue), Pallets, and optional Actual minutes (how long each issue order really took from creation to dispatch).</p>
      <div class="btnrow"><button class="btn" id="rpTpl">Download template</button><button class="btn" id="rpDemo">Try with a sample day</button></div>
      ${live ? `<div class="card"><b>Replay running · ${live.fired} of ${live.total} events released</b><p>Clock ${S.clock(S.st.t)}. Random arrivals are switched off until it ends.</p><div class="btnrow"><button class="btn" id="rpStop">Stop the replay</button></div></div>` : ''}
      <div id="rpOut"></div>`;
    const drop = el.querySelector('#rpDrop'), inp = el.querySelector('#rpFile');
    drop.addEventListener('click', () => inp.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    const load = async (file) => { try { day = parse(await B.importer.readFile(file), file.name); analyse(); render(el); } catch (e) { B.tools.toast(e.message, 6000); } };
    inp.addEventListener('change', () => inp.files[0] && load(inp.files[0]));
    drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && load(e.dataTransfer.files[0]));
    el.querySelector('#rpTpl').addEventListener('click', () => B.tools.download('building100-day-template.csv', template()));
    el.querySelector('#rpDemo').addEventListener('click', () => { day = parse(B.importer.parseCSV(template()), 'Sample day'); analyse(); render(el); });
    if (live) el.querySelector('#rpStop').addEventListener('click', () => { S.replay = null; B.tools.toast('Replay stopped: random arrivals are back on'); render(el); });
    if (day && result && result.runs) show(el.querySelector('#rpOut'));
  }
  function show(out) {
    const cur = result.runs.find((q) => q.k === result.at).r;
    const inP = day.ins.reduce((a, e) => a + e.n, 0), outP = day.outs.reduce((a, e) => a + Math.min(6, e.n), 0);
    const peak = result.hourly.reduce((m, q, hh) => (q.in + q.out > m.v ? { v: q.in + q.out, hh } : m), { v: 0, hh: 0 });
    let verdict = '';
    if (result.actual != null) {
      const gap = result.actual - cur.cycle;
      verdict = `<div class="card"><b>Real ${fmt(result.actual, 1)} min against modelled ${fmt(cur.cycle, 1)} min per order</b><p>${gap > 2 ? 'About ' + fmt(gap, 0) + ' minutes per order are lost to things the model does not include: paperwork, waiting for the truck, searching for stock or approvals. That is the improvement potential.' : 'The real day ran as fast as the model: the floor is working close to its capacity.'}</p></div>`;
    }
    out.innerHTML = `<h4>${P.esc(day.label)} · ${day.ev.length} events from ${S.clock(day.ev[0].t)} to ${S.clock(day.ev[day.ev.length - 1].t)}</h4>
      <div class="row2"><div class="stat"><b>${fmt(inP)}</b><small>pallets received in ${day.ins.length} trucks</small></div><div class="stat"><b>${fmt(outP)}</b><small>pallets issued in ${day.outs.length} orders</small></div>
      <div class="stat"><b>${String(peak.hh).padStart(2, '0')}:00</b><small>busiest hour (${peak.v} pallets)</small></div><div class="stat"><b>${fmt(cur.waitMax, 1)} min</b><small>longest wait for a forklift</small></div></div>
      ${verdict}
      <table><thead><tr><th>Forklifts</th><th class="num">Cycle time</th><th class="num">Utilisation</th><th class="num">Longest wait</th></tr></thead><tbody>
      ${result.runs.map(({ k, r }) => '<tr' + (k === result.at ? ' style="font-weight:700"' : '') + '><td>' + k + (k === result.at ? ' (now)' : '') + '</td><td class="num">' + fmt(r.cycle, 1) + ' min</td><td class="num">' + fmt(r.util * 100, 0) + '%</td><td class="num">' + fmt(r.waitMax, 1) + ' min</td></tr>').join('')}</tbody></table>
      <canvas id="rpChart" width="840" height="300"></canvas>
      ${result.live ? `<div class="card"><b>Live 3D replay result</b><p>Finished at ${result.live.clock}: ${result.live.received} pallets put away, ${result.live.shipped} shipped, order cycle time ${result.live.cycle ? fmt(result.live.cycle, 1) + ' min' : 'n/a'}, forklift utilisation ${fmt(result.live.util * 100, 0)}%.</p></div>` : ''}
      <div class="btnrow"><button class="btn primary" id="rpPlay">Play this day in 3D</button></div>`;
    chart(out.querySelector('#rpChart'), cur);
    out.querySelector('#rpPlay').addEventListener('click', play);
  }
  function chart(c, r) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), bad = cs.getPropertyValue('--bad').trim(), info = '#3a7bd5';
    const hs = result.hourly.map((q, hh) => hh).filter((hh) => result.hourly[hh].in + result.hourly[hh].out > 0 || r.backlog[hh] > 0);
    const h0 = Math.min(...hs), h1 = Math.max(...hs) + 1, bw = 740 / (h1 - h0), max = Math.max(1, ...result.hourly.map((q) => Math.max(q.in, q.out)), ...r.backlog);
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '600 17px "IBM Plex Sans", sans-serif';
    for (let hh = h0; hh < h1; hh++) {
      const x = 70 + (hh - h0) * bw, q = result.hourly[hh];
      ctx.fillStyle = info; ctx.fillRect(x + 4, 250 - (q.in / max) * 210, bw / 2 - 6, (q.in / max) * 210);
      ctx.fillStyle = acc; ctx.fillRect(x + bw / 2, 250 - (q.out / max) * 210, bw / 2 - 6, (q.out / max) * 210);
      ctx.fillStyle = muted; ctx.fillText(String(hh).padStart(2, '0'), x + bw / 2 - 10, 276);
    }
    ctx.strokeStyle = bad; ctx.lineWidth = 3; ctx.beginPath();
    for (let hh = h0; hh < h1; hh++) { const x = 70 + (hh - h0 + 0.5) * bw, y = 250 - (r.backlog[hh] / max) * 210; hh === h0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = info; ctx.fillText('received', 70, 22); ctx.fillStyle = acc; ctx.fillText('issued', 170, 22); ctx.fillStyle = bad; ctx.fillText('pallets waiting for a forklift', 250, 22);
  }
  B.tools.add({ id: 'replay', label: 'Replay a day', render });
  B.replay = { parse, analyse: () => analyse(), play, result: () => result, load: (rows, label) => { day = parse(rows, label); analyse(); return result; } };
})();
