/* Building 19 - cross-docking: part of the inbound pallets go straight to an outbound lane, skipping storage */
(function () {
  const B = window.B100, S = B.sim, W = B.world;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const R = B.rng(616);
  const opts = { share: 0.12 };
  const st = { n: 0, savedM: 0, collected: 0 };
  const waiting = [];

  // convert a share of fresh put-away tasks before a forklift takes them
  B.hooks.frame.push(() => {
    S.tasks.forEach((t) => {
      if (t.type !== 'put' || t.fl || t.xChecked) return;
      t.xChecked = true;
      if (R() >= opts.share) return;
      const door = W.doorsOut.find((d) => !d.busy && !S.orders.some((o) => o.door === d) && !S.pendingOrders.some((o) => o.door === d));
      const spot = door && W.stageOut.find((p) => p.door === door && !p.used && !p.cross);
      if (!spot) return;
      const slot = t.to;
      slot.reserved = false;
      st.savedM += Math.max(0, 2 * B.slotting.cost(slot) - 70);
      Object.assign(t, { to: spot, cross: true, slot });
      spot.cross = true;
    });
    // pallets in the outbound lane are collected by the project truck after about 10 minutes
    for (let i = waiting.length - 1; i >= 0; i--) {
      const w = waiting[i];
      if (S.st.t - w.t < 600) continue;
      if (w.spot.used) { W.scene.remove(w.spot.used); w.spot.used = null; }
      w.spot.cross = false; waiting.splice(i, 1); st.collected++;
    }
  });
  S.onCrossDock = (t) => {
    st.n++;
    waiting.push({ spot: t.to, t: S.st.t });
    if (B.audit) B.audit.record({ action: 'Cross-docked', code: 'OUT ' + t.to.door.n, mat: B.ITEMS[t.item] ? B.ITEMS[t.item].mat : '', name: B.ITEMS[t.item] ? B.ITEMS[t.item].name : '', qty: t.qty, by: 'Forklift ' + t.fl.n, ref: 'Straight from receiving' });
  };

  function render(el) {
    const hours = (st.savedM / 2.8) / 3600;
    el.innerHTML = `<h4>Cross-docking</h4><p>Some deliveries are needed on site right away. Instead of storing them and picking them again later, the forklift takes the pallet straight from receiving to an outbound lane, where the project truck collects it.</p>
      <div class="row2"><div class="stat"><b>${fmt(st.n)}</b><small>pallets cross-docked</small></div><div class="stat"><b>${fmt(st.savedM / 1000, 1)} km</b><small>forklift driving saved</small></div>
      <div class="stat"><b>${fmt(hours * 60, 0)} min</b><small>forklift time saved</small></div><div class="stat"><b>${fmt(st.n * 2)}</b><small>rack moves avoided (store + pick)</small></div></div>
      <label class="f">Share of inbound pallets that go straight out: <b id="cdV">${Math.round(opts.share * 100)}%</b><input type="range" id="cdS" min="0" max="40" value="${Math.round(opts.share * 100)}"></label>
      <p>Set it to 0% to switch cross-docking off and compare forklift utilisation and order cycle time.</p>`;
    const s = el.querySelector('#cdS');
    s.addEventListener('input', () => { opts.share = +s.value / 100; el.querySelector('#cdV').textContent = s.value + '%'; });
  }
  B.tools.add({ id: 'crossdock', label: 'Cross-dock', render });
  B.crossdock = { opts, stats: st };
})();
