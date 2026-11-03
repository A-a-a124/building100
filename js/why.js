/* Building 19 - why this number: click an indicator and the twin explains what is driving it and shows the place in 3D */
(function () {
  const B = window.B100, S = B.sim, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const nearZones = {};
  const addLog = S.addLog;
  S.addLog = (m, k) => { const q = /^Near miss: .* in (.+)$/.exec(m); if (q) nearZones[q[1]] = (nearZones[q[1]] || 0) + 1; addLog(m, k); };

  const fleetState = () => {
    const f = S.forklifts, moving = f.filter((q) => q.task && !q.down).length, down = f.filter((q) => q.down).length, charge = f.filter((q) => q.phase === 'charging' || q.needCharge).length;
    return { total: f.length, moving, down, charge, free: f.length - moving - down - charge };
  };
  const rowsBy = () => B.RACK.rows.map((r, i) => ({ r, i, n: B.SLOTS.filter((s) => s.row === i && s.item >= 0).length / (B.RACK.bays * B.RACK.levels * 2) })).sort((a, b) => b.n - a.n);
  const gate = () => (S.gate || []).length;
  // each reason: [weight 0-1, text, how to show it]
  const WHY = {
    cycle() {
      const stages = { paper: S.pendingOrders.filter((o) => (o.readyAt || 0) > S.st.t).length, door: S.pendingOrders.filter((o) => (o.readyAt || 0) <= S.st.t).length, pick: S.orders.filter((o) => o.picked < o.lines).length, truck: S.orders.filter((o) => o.waitTruck).length, load: S.trucks.filter((t) => t.dir === 'out').length };
      const f = fleetState(), tot = Math.max(1, stages.paper + stages.door + stages.pick + stages.truck + stages.load);
      return [
        [stages.truck / tot, stages.truck + ' orders are staged and waiting for their truck', () => B.ui.focusZone('DSP')],
        [stages.door / tot, stages.door + ' orders are waiting for a free shipping door', () => B.ui.focusZone('DSP')],
        [stages.pick / tot, stages.pick + ' orders are being picked; ' + f.free + ' of ' + f.total + ' forklifts are free', () => B.ui.setView('rack')],
        [stages.paper / tot, stages.paper + ' orders are still being checked and printed', () => B.ui.focusZone('OFF')],
        [stages.load / tot, stages.load + ' trucks are loading now', () => B.ui.setView('dsp')],
      ];
    },
    util() {
      const f = fleetState(), n = Math.max(1, f.total);
      return [
        [f.moving / n, f.moving + ' forklifts have a job right now', () => B.ui.setView('rack')],
        [f.charge / n, f.charge + ' forklifts are charging or going to charge', () => B.ui.focusZone('CHG')],
        [f.down / n, f.down + ' forklifts are broken down or in service', () => B.tools.open('fleet')],
        [f.free / n, f.free + ' forklifts are free', () => B.ui.focusZone('CHG')],
        [Math.min(1, S.tasks.filter((t) => !t.fl).length / 15), S.tasks.filter((t) => !t.fl).length + ' pallet moves are waiting for a forklift', () => B.ui.setView('rcv')],
      ];
    },
    occ() {
      const r = rowsBy(), st = B.stock.compute();
      return r.slice(0, 3).map((q) => [q.n, 'Row ' + q.r.letter + ' is the fullest area at ' + fmt(q.n * 100, 0) + '%', () => B.ui.focusSlot(B.SLOTS.find((s) => s.row === q.i && s.bay === 12))])
        .concat([[st.frozenPallets / B.SLOTS.length * 3, fmt(st.frozenPallets) + ' pallets have not moved for a year and hold space', () => B.tools.open('value')]]);
    },
    open() {
      const put = S.tasks.filter((t) => t.type === 'put').length, pick = S.tasks.filter((t) => t.type === 'pick').length, wait = S.pendingOrders.reduce((n, o) => n + o.lines, 0), tot = Math.max(1, put + pick + wait), f = fleetState();
      return [
        [put / tot, put + ' pallets from receiving waiting to be put away', () => B.ui.focusZone('RCV')],
        [pick / tot, pick + ' pallets being picked for issue orders', () => B.ui.setView('rack')],
        [wait / tot, wait + ' pallets on orders not yet released', () => B.ui.focusZone('DSP')],
        [(f.down + f.charge) / Math.max(1, f.total), (f.down + f.charge) + ' forklifts out of action, so the queue clears more slowly', () => B.tools.open('fleet')],
      ];
    },
    near() {
      const z = Object.entries(nearZones).sort((a, b) => b[1] - a[1]), tot = Math.max(1, S.st.nearMiss || 0);
      const out = z.slice(0, 4).map(([name, n]) => { const zn = B.ZONES.find((q) => q.name === name); return [n / tot, n + ' near misses in ' + name, () => (zn ? B.ui.focusZone(zn.id) : B.ui.setView('top'))]; });
      return out.length ? out : [[0.2, 'No near misses recorded yet', () => {}]];
    },
    received() { const inT = S.trucks.filter((t) => t.dir === 'in').length, r = S.RATES[S.st.rate]; return [[inT / 4, inT + ' of 4 inbound doors have a truck', () => B.ui.focusZone('RCV')], [gate() / 3, gate() + ' trucks waiting at the gate', () => B.tools.open('carriers')], [r.trucks / 6, fmt(r.trucks, 1) + ' trucks an hour at the ' + r.name.toLowerCase() + ' workload', () => {}]]; },
    shipped() { const o = S.trucks.filter((t) => t.dir === 'out').length, r = S.RATES[S.st.rate]; return [[o / 4, o + ' of 4 shipping doors are loading', () => B.ui.focusZone('DSP')], [S.orders.filter((q) => q.waitTruck).length / 4, S.orders.filter((q) => q.waitTruck).length + ' orders staged, waiting for their truck', () => B.ui.focusZone('DSP')], [r.orders / 8, fmt(r.orders, 1) + ' orders an hour at the ' + r.name.toLowerCase() + ' workload', () => {}]]; },
  };
  const NAMES = { cycle: 'Order cycle time', util: 'Forklift utilisation', occ: 'Rack occupancy', open: 'Open tasks', near: 'Near misses', received: 'Pallets put away', shipped: 'Pallets shipped' };

  const card = document.createElement('div');
  card.className = 'whycard'; card.hidden = true;
  B.three.stage.appendChild(card);
  let cur = null, reasons = [];
  function paint() {
    if (!cur) return;
    reasons = WHY[cur]().sort((a, b) => b[0] - a[0]).filter((r) => r[1] && !/^0 /.test(r[1]));
    const val = (document.getElementById('k_' + cur) || {}).textContent;
    card.innerHTML = '<div class="whyH"><b>Why is ' + NAMES[cur].toLowerCase() + ' ' + P.esc(val || '') + '?</b><button class="chip" id="whyX">Close</button></div>' +
      reasons.map((r, i) => '<div class="whyR" data-w="' + i + '"><span>' + P.esc(r[1]) + '</span><i><u style="width:' + Math.max(4, Math.min(100, r[0] * 100)) + '%"></u></i></div>').join('') + '<small>Live from the twin. Click a line to see it in 3D.</small>';
    card.querySelector('#whyX').addEventListener('click', () => { cur = null; card.hidden = true; });
    card.querySelectorAll('[data-w]').forEach((d) => d.addEventListener('click', () => reasons[+d.dataset.w][2]()));
  }
  Object.keys(WHY).forEach((k) => {
    const tile = document.getElementById('k_' + k); if (!tile) return;
    const t = tile.closest('.kpi'); t.style.cursor = 'pointer'; t.title = 'Click to see why';
    t.addEventListener('click', () => { cur = cur === k ? null : k; card.hidden = !cur; paint(); });
  });
  let tm = 0;
  B.hooks.frame.push((dt) => { if (cur && (tm += dt) > 2 && !card.matches(':hover')) { tm = 0; paint(); } });
  const css = document.createElement('style');
  css.textContent = `.whycard { position: absolute; z-index: 6; left: 50%; bottom: 12px; transform: translateX(-50%); width: min(520px, calc(100% - 24px)); background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--accent-strong); border-radius: 12px; box-shadow: var(--shadow); padding: 10px 14px; display: grid; gap: 6px; font-size: 13px; }
    .whyH { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .whyH b { font: 700 15px var(--f-display); } .whyR { display: grid; gap: 3px; cursor: pointer; padding: 3px 4px; border-radius: 6px; } .whyR:hover { background: var(--surface-2); } .whyR i { display: block; height: 5px; background: var(--surface-2); border-radius: 3px; overflow: hidden; } .whyR u { display: block; height: 100%; background: var(--accent-strong); } .whycard small { color: var(--muted); } body.cine .whycard { display: none; } .kpi:hover { border-color: var(--accent); }`;
  document.head.appendChild(css);
  B.why = { show: (k) => { cur = k; card.hidden = false; paint(); }, reasons: (k) => WHY[k]() };
})();
