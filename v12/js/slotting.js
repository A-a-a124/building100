/* Building 100 - slotting: move fast movers close to shipping and low in the racks, with the travel saving in numbers */
(function () {
  const B = window.B100, W = B.world, S = B.sim, T = THREE;
  const L = B.LANES, LIFT_M = 11.7; // one rack level of lifting costs about as much time as 11.7 m of driving
  let movesGroup = null, plan = null;

  // driving distance from a slot to the nearest outbound door, plus lift time as equivalent metres
  function cost(s) {
    let best = Infinity;
    for (const d of W.doorsOut) for (const xc of [L.west, L.east]) best = Math.min(best, Math.abs(s.x - xc) + Math.abs(s.access - L.back) + Math.abs(xc - d.x) + 6);
    return best + (s.level - 1) * LIFT_M;
  }
  // how often an item moves: recent movement means a fast mover
  const velocity = (s) => 1 / (1 + s.days / 14);

  function analyse() {
    const occ = B.SLOTS.filter((s) => s.item >= 0);
    const costs = new Map(B.SLOTS.map((s) => [s, cost(s)]));
    const wsum = occ.reduce((n, s) => n + velocity(s), 0) || 1;
    const before = occ.reduce((n, s) => n + velocity(s) * costs.get(s), 0) / wsum;
    // ideal: fastest movers in the cheapest slots
    const items = occ.slice().sort((a, b) => velocity(b) - velocity(a));
    const slots = B.SLOTS.slice().sort((a, b) => costs.get(a) - costs.get(b));
    const ideal = new Map();
    items.forEach((s, i) => ideal.set(s, slots[i]));
    const after = items.reduce((n, s, i) => n + velocity(s) * costs.get(slots[i]), 0) / wsum;
    const moves = items.filter((s) => ideal.get(s) !== s).map((s) => ({ from: s, to: ideal.get(s), gain: velocity(s) * (costs.get(s) - costs.get(ideal.get(s))) }))
      .filter((m) => m.gain > 0).sort((a, b) => b.gain - a.gain);
    // effect of only the top 25 moves, applied as swaps
    const top = moves.slice(0, 25);
    const vOf = new Map(occ.map((s) => [s, velocity(s)]));
    let topCost = before * wsum;
    top.forEach((m) => {
      const va = vOf.get(m.from) || 0, vb = vOf.get(m.to) || 0;
      topCost += va * (costs.get(m.to) - costs.get(m.from)) + vb * (costs.get(m.from) - costs.get(m.to));
      vOf.set(m.to, va); vOf.set(m.from, vb);
    });
    plan = { before, after, top25: topCost / wsum, moves, ideal, costs };
    return plan;
  }

  function yearly(dist) {
    const rate = S.RATES[S.st.rate];
    const picks = rate.orders * 4 * 16 * 300;
    return { picks, km: (picks * 2 * dist) / 1000 };
  }

  function showMoves(on) {
    if (movesGroup) { W.scene.remove(movesGroup); movesGroup = null; }
    if (!on || !plan) return;
    movesGroup = new T.Group();
    const mat = new T.LineBasicMaterial({ color: '#f2b31b' });
    plan.moves.slice(0, 25).forEach((m) => {
      const a = new T.Vector3(m.from.x, m.from.y + 1, m.from.z), b = new T.Vector3(m.to.x, m.to.y + 1, m.to.z);
      const mid = a.clone().lerp(b, 0.5); mid.y = 13 + a.distanceTo(b) * 0.06;
      const curve = new T.QuadraticBezierCurve3(a, mid, b);
      movesGroup.add(new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(32)), mat));
      const dot = new T.Mesh(new T.SphereGeometry(0.35, 12, 8), new T.MeshBasicMaterial({ color: '#2fb36b' }));
      dot.position.copy(b);
      movesGroup.add(dot);
    });
    W.scene.add(movesGroup);
  }

  function applyMoves(n) {
    if (!plan) analyse();
    let done = 0;
    for (const m of plan.moves.slice(0, n)) {
      const a = m.from, b = m.to;
      if (a.reserved || b.reserved) continue;
      [a.item, b.item] = [b.item, a.item]; [a.qty, b.qty] = [b.qty, a.qty]; [a.days, b.days] = [b.days, a.days];
      W.updateSlot(a, true); W.updateSlot(b, true);
      done++;
    }
    W.flagPallets();
    showMoves(false);
    analyse();
    return done;
  }

  function render(el) {
    const p = analyse(), fmt = B.tools.fmt;
    const y0 = yearly(p.before), y1 = yearly(p.after), y25 = yearly(p.top25);
    const pct = (a) => ((1 - a / p.before) * 100).toFixed(1);
    el.innerHTML = `
      <h4>Slotting: put fast movers close to shipping</h4>
      <p>Each pallet's pick cost is the driving distance from its slot to the nearest outbound door, plus lift time for higher levels. Fast movers are items that moved recently.</p>
      <div class="row2">
        <div class="stat"><b>${p.before.toFixed(0)} m</b><small>average pick distance now</small></div>
        <div class="stat"><b style="color:var(--ok)">${p.after.toFixed(0)} m</b><small>after full re-slotting (&minus;${pct(p.after)}%)</small></div>
        <div class="stat"><b>${fmt(y0.km - y1.km)} km</b><small>forklift driving saved per year</small></div>
        <div class="stat"><b>${fmt((y0.km - y1.km) / 10)} h</b><small>forklift hours saved per year</small></div>
      </div>
      <p>Moving only the top 25 pallets already cuts pick distance by <b>${pct(p.top25)}%</b> (${fmt(y0.km - y25.km)} km a year). Based on ${fmt(y0.picks)} picks a year at the current workload.</p>
      <div class="btnrow"><button class="btn" id="slShow">Show top 25 moves on the map</button><button class="btn primary" id="slApply">Apply top 25 moves</button><button class="btn" id="slAll">Apply all ${fmt(p.moves.length)}</button></div>
      <table><thead><tr><th>Material</th><th>From</th><th>To</th><th class="num">Saving</th></tr></thead><tbody>
      ${p.moves.slice(0, 25).map((m) => `<tr><td>${B.panel.esc(B.ITEMS[m.from.item].name).slice(0, 28)}</td><td><button class="loc" data-slot="${m.from.i}">${m.from.code}</button></td><td><button class="loc" data-slot="${m.to.i}">${m.to.code}</button></td><td class="num good">${(p.costs.get(m.from) - p.costs.get(m.to)).toFixed(0)} m</td></tr>`).join('')}
      </tbody></table>
      <p>Fast or slow is estimated from days since last movement. Import pick counts to make it exact.</p>`;
    let shown = false;
    el.querySelector('#slShow').addEventListener('click', (e) => { shown = !shown; showMoves(shown); e.target.textContent = shown ? 'Hide moves' : 'Show top 25 moves on the map'; if (shown) B.ui.setView('rack'); });
    el.querySelector('#slApply').addEventListener('click', () => { const n = applyMoves(25); B.tools.toast(n + ' pallets moved to better slots'); B.tools.refresh(); });
    el.querySelector('#slAll').addEventListener('click', () => { const n = applyMoves(1e9); B.tools.toast(B.tools.fmt(n) + ' pallets re-slotted'); B.tools.refresh(); });
  }

  B.tools.add({ id: 'slotting', label: 'Slotting', render });
  B.slotting = { cost, velocity, analyse, clear: () => { showMoves(false); plan = null; }, plan: () => plan || analyse() };
})();
