/* Building 100 - returns: material sent back from sites is inspected in QC, then put back in stock, repaired or scrapped */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const R = B.rng(818);
  const opts = { perHour: 0.6 };
  const REASONS = ['Surplus from a finished project', 'Wrong material delivered', 'Damaged in transport', 'Order cancelled on site'];
  const SITES = ['Project site 1', 'Project site 2', 'Plant maintenance', 'Pipeline crew'];
  const list = [];
  const spots = Array.from({ length: 6 }, (_, k) => ({ x: -47, z: -22.4 + k * 1.8, used: null }));
  const tagMat = new T.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#ff6a00', emissiveIntensity: 0.5 });

  function arrive() {
    const spot = spots.find((s) => !s.used);
    const stocked = B.ITEMS.filter((it) => B.SLOTS.some((s) => s.item === it.i));
    if (!spot || !stocked.length) return;
    const it = stocked[Math.floor(R() * stocked.length)];
    const p = W.makePallet(it.i), tag = new T.Mesh(new T.BoxGeometry(0.4, 0.3, 0.05), tagMat);
    tag.position.set(0, 0.9, 0.52); p.add(tag); p.position.set(spot.x, 0, spot.z); W.scene.add(p);
    const reason = REASONS[Math.floor(R() * REASONS.length)];
    const r = { id: 'RT-' + (300 + list.length), item: it, qty: Math.max(1, Math.round(it.per * (0.2 + R() * 0.6))), reason, site: SITES[Math.floor(R() * SITES.length)],
      at: S.st.t, done: S.st.t + (30 + R() * 60) * 60, status: 'Inspecting in QC', spot, mesh: p };
    spot.used = p; list.unshift(r);
    S.addLog('Return ' + r.id + ' arrived from ' + r.site + ': ' + it.name + ' (' + reason.toLowerCase() + ')', 'in');
  }
  function decide(r) {
    const damaged = r.reason === 'Damaged in transport', u = R();
    const outcome = damaged ? (u < 0.5 ? 'repair' : 'scrap') : u < 0.85 ? 'stock' : 'scrap';
    if (outcome === 'stock') {
      const rows = B.ROW_CAT.map((c, i) => (c === r.item.cat ? i : -1)).filter((i) => i >= 0);
      const s = B.SLOTS.find((q) => q.item < 0 && !q.reserved && rows.includes(q.row)) || B.SLOTS.find((q) => q.item < 0 && !q.reserved);
      if (s) {
        s.item = r.item.i; s.qty = r.qty; s.days = 0; S.occ++;
        B.audit.by = 'Returns'; B.audit.ref = r.id; W.updateSlot(s); setTimeout(() => { B.audit.by = ''; B.audit.ref = ''; }, 400);
        r.status = 'Back in stock at ' + s.code; r.slot = s;
      } else r.status = 'Waiting for a free location';
    } else r.status = outcome === 'repair' ? 'Sent for repair' : 'Scrapped';
    r.outcome = outcome;
    W.scene.remove(r.mesh); r.spot.used = null;
    S.addLog('Return ' + r.id + ': ' + r.status.toLowerCase(), 'info');
  }

  let last = S.st.t;
  B.hooks.frame.push(() => {
    const dt = Math.max(0, S.st.t - last); last = S.st.t;
    if (S.st.running && R() < (opts.perHour / 3600) * dt) arrive();
    list.forEach((r) => { if (!r.outcome && S.st.t >= r.done) decide(r); });
  });

  function render(el) {
    const done = list.filter((r) => r.outcome), back = done.filter((r) => r.outcome === 'stock');
    const val = back.reduce((n, r) => n + r.qty * B.stock.price(r.item), 0);
    el.innerHTML = `<h4>Returns</h4><p>Material comes back from sites: surplus, wrong deliveries, damage. Each return waits in Quality Inspection (orange tag), then goes back to stock, out for repair, or to scrap.</p>
      <div class="row2"><div class="stat"><b>${list.length}</b><small>returns received</small></div><div class="stat"><b>${list.filter((r) => !r.outcome).length}</b><small>waiting in inspection</small></div>
      <div class="stat"><b>${done.length ? fmt((back.length / done.length) * 100, 0) + '%' : '-'}</b><small>put back in stock</small></div><div class="stat"><b>${B.stock.sar(val)}</b><small>value recovered</small></div></div>
      <div class="btnrow"><button class="btn primary" id="rtNew">Receive a return now</button><button class="btn" id="rtLook">Show inspection area</button></div>
      <table><thead><tr><th>Return</th><th>Material</th><th>Status</th></tr></thead><tbody>
      ${list.slice(0, 15).map((r) => '<tr><td class="code">' + r.id + '<br><small>' + S.clock(r.at) + '</small></td><td>' + P.esc(r.item.name) + '<br><small>' + P.esc(r.reason) + ' · ' + r.site + '</small></td><td class="' + (r.outcome === 'stock' ? 'good' : r.outcome === 'scrap' ? 'bad' : '') + '">' + P.esc(r.status) + '</td></tr>').join('') || '<tr><td colspan="3">No returns yet.</td></tr>'}</tbody></table>`;
    el.querySelector('#rtNew').addEventListener('click', () => { arrive(); render(el); });
    el.querySelector('#rtLook').addEventListener('click', () => B.ui.focusZone('QC'));
  }
  B.tools.add({ id: 'returns', label: 'Returns', render });
  B.returns = { list, arrive, opts };
})();
