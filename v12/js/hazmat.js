/* Building 100 - hazardous materials rules: flags incompatible materials stored too close together in the cage */
(function () {
  const B = window.B100, W = B.world, T = THREE, P = B.panel;
  const zn = B.zoneById('HAZ');
  const CLASS = {
    flam: { name: 'Flammable liquid', ghs: 'GHS class 3', color: '#d64541' },
    corr: { name: 'Corrosive', ghs: 'GHS class 8', color: '#7d5bc6' },
    oxid: { name: 'Oxidiser', ghs: 'GHS class 5.1', color: '#e2a400' },
    fgas: { name: 'Flammable gas', ghs: 'GHS class 2.1', color: '#c0392b' },
    ogas: { name: 'Oxidising gas', ghs: 'GHS class 2.2 (5.1)', color: '#3a7bc8' },
    igas: { name: 'Inert gas', ghs: 'GHS class 2.2', color: '#4a5560' },
  };
  // minimum clear distance between two classes (metres)
  const RULES = [
    ['fgas', 'ogas', 6.1, 'Oxygen must be 6.1 m (20 ft) from fuel gas cylinders, or behind a 1.5 m high fire wall (OSHA 1910.253).'],
    ['corr', 'oxid', 5, 'Acids and hypochlorite release chlorine gas if they mix: store in separate bunded areas at least 5 m apart.'],
    ['flam', 'oxid', 3, 'Oxidisers feed a fire: keep them at least 3 m from flammable liquids (HSG71 segregation table).'],
    ['fgas', 'oxid', 3, 'Keep oxidisers at least 3 m from flammable gas cylinders.'],
    ['flam', 'ogas', 3, 'Keep oxidising gas at least 3 m from flammable liquids.'],
  ];
  const rowX = (r) => zn.x[0] + 3.5 + r * 4.2;
  const drumRow = (r, name, cls) => ({ id: 'row' + (r + 1), name, cls, where: 'Drum row ' + (r + 1), x0: rowX(r) - 0.65, x1: rowX(r) + 0.65, z0: zn.z[0] + 2.85, z1: zn.z[0] + 13.65 });
  const cylX = (k) => zn.x[0] + 4 + (k % 12) * 0.4, cylZ = (k) => zn.z[1] - 4 + Math.floor(k / 12) * 0.5;
  const ORIGINAL = () => [
    drumRow(0, 'Industrial Solvent', 'flam'), drumRow(1, 'Acid Cleaner', 'corr'), drumRow(2, 'Epoxy Paint', 'flam'), drumRow(3, 'Sodium Hypochlorite', 'oxid'),
    { id: 'acet', name: 'Acetylene Cylinder', cls: 'fgas', where: 'Cylinder rack, left', x0: cylX(0) - 0.15, x1: cylX(9) + 0.15, z0: cylZ(0) - 0.15, z1: cylZ(0) + 0.15, k: [0, 10] },
    { id: 'nitro', name: 'Nitrogen Cylinder', cls: 'igas', where: 'Cylinder rack, middle', x0: cylX(10) - 0.15, x1: cylX(17) + 0.15, z0: cylZ(0) - 0.15, z1: cylZ(12) + 0.15, k: [10, 18] },
    { id: 'oxy', name: 'Oxygen Cylinder', cls: 'ogas', where: 'Cylinder rack, right', x0: cylX(18) - 0.15, x1: cylX(23) + 0.15, z0: cylZ(18) - 0.15, z1: cylZ(18) + 0.15, k: [18, 24] },
  ];
  let groups = ORIGINAL();
  // the safe places each problem material can be moved to
  const FIX = {
    oxy: { where: 'Oxygen rack on the east wall', x0: zn.x[1] - 4.4, x1: zn.x[1] - 2.2, z0: zn.z[1] - 4.15, z1: zn.z[1] - 3.35 },
    row4: { where: 'Oxidiser cabinet, north-east corner', x0: zn.x[1] - 4.2, x1: zn.x[1] - 1.8, z0: zn.z[1] - 12, z1: zn.z[1] - 10.6 },
  };

  const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
  function violations() {
    const out = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      const rule = RULES.find((r) => (r[0] === a.cls && r[1] === b.cls) || (r[1] === a.cls && r[0] === b.cls));
      if (!rule) continue;
      const d = gap(a, b);
      if (d < rule[2]) out.push({ a, b, d, need: rule[2], why: rule[3] });
    }
    return out;
  }

  // ---------- 3D: coloured cylinders, moved stock, warning lines ----------
  const cyl = W.cylinders;
  cyl.material = new T.MeshStandardMaterial({ color: '#ffffff', metalness: 0.45, roughness: 0.45 });
  const CYL_COL = { acet: '#7a1f1f', nitro: '#2b2f33', oxy: '#e9edf0' };
  const M4 = new T.Matrix4(), C = new T.Color();
  const drums = (() => { let m = null; W.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 96) m = o; }); return m; })();
  const spills = []; W.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && Math.abs(o.position.x - rowX(3)) < 0.01 && o.position.y === 0.15) spills.push(o); });
  const cabinet = new T.Group();
  const cab = W.box(2.4, 1.9, 1.4, '#e2a400', { roughness: 0.5, metalness: 0.3 }); cab.position.y = 0.95;
  const stripe = W.box(2.42, 0.12, 1.42, '#1a1a1a'); stripe.position.y = 1.5;
  cabinet.add(cab, stripe); cabinet.visible = false;
  W.scene.add(cabinet);
  const warn = new T.Group(); W.scene.add(warn);
  const lineMat = new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.9, depthTest: false });

  function draw() {
    const oxy = groups.find((g) => g.id === 'oxy');
    for (let k = 0; k < 24; k++) {
      const g = groups.find((q) => q.k && k >= q.k[0] && k < q.k[1]);
      let x = cylX(k), z = cylZ(k);
      if (g.id === 'oxy' && oxy.moved) { x = FIX.oxy.x0 + 0.15 + (k - 18) * 0.4; z = FIX.oxy.z0 + 0.4; }
      M4.makeTranslation(x, 0.75, z); cyl.setMatrixAt(k, M4);
      cyl.setColorAt(k, C.set(CYL_COL[g.id]));
    }
    cyl.instanceMatrix.needsUpdate = true; cyl.instanceColor.needsUpdate = true;
    const hypo = groups.find((g) => g.id === 'row4');
    if (drums) {
      for (let i = 72; i < 96; i++) {
        drums.getMatrixAt(i, M4);
        const p = new T.Vector3().setFromMatrixPosition(M4);
        M4.makeScale(hypo.moved ? 0.0001 : 1, hypo.moved ? 0.0001 : 1, hypo.moved ? 0.0001 : 1).setPosition(p);
        drums.setMatrixAt(i, M4);
      }
      drums.instanceMatrix.needsUpdate = true;
    }
    spills.forEach((s) => (s.visible = !hypo.moved));
    cabinet.visible = !!hypo.moved;
    cabinet.position.set((FIX.row4.x0 + FIX.row4.x1) / 2, 0, (FIX.row4.z0 + FIX.row4.z1) / 2);
    while (warn.children.length) warn.remove(warn.children[0]);
    violations().forEach((v) => {
      const ax = Math.max(v.a.x0, Math.min(v.a.x1, (v.b.x0 + v.b.x1) / 2)), az = Math.max(v.a.z0, Math.min(v.a.z1, (v.b.z0 + v.b.z1) / 2));
      const bx = Math.max(v.b.x0, Math.min(v.b.x1, ax)), bz = Math.max(v.b.z0, Math.min(v.b.z1, az));
      const len = Math.max(0.6, Math.hypot(bx - ax, bz - az));
      const bar = new T.Mesh(new T.BoxGeometry(len, 0.08, 0.08), lineMat);
      bar.position.set((ax + bx) / 2, 1.9, (az + bz) / 2); bar.rotation.y = -Math.atan2(bz - az, bx - ax); bar.renderOrder = 12;
      const ring = new T.Mesh(new T.RingGeometry(1.4, 1.75, 36), lineMat); ring.rotation.x = -Math.PI / 2; ring.position.set((ax + bx) / 2, 0.1, (az + bz) / 2); ring.renderOrder = 12;
      const lab = W.makeLabel(('Too close: ' + v.d.toFixed(1) + ' m, needs ' + v.need + ' m'), { size: 0.7, bg: 'rgba(200,30,30,0.95)', weight: 700, depthTest: true });
      lab.position.set((ax + bx) / 2, 3, (az + bz) / 2);
      warn.add(bar, ring, lab);
    });
  }
  let pulse = 0;
  B.hooks.frame.push((dt) => { pulse += dt * 4; lineMat.opacity = 0.55 + 0.4 * Math.sin(pulse); });

  function fix(id) {
    const g = groups.find((q) => q.id === id), f = FIX[id];
    if (!g || !f) return;
    Object.assign(g, { x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, where: f.where, moved: true });
    if (B.audit) B.audit.record({ action: 'Hazmat moved', code: 'HAZ', mat: '', name: g.name, qty: '', by: 'Supervisor', ref: 'To ' + f.where });
    draw(); B.tools.refresh();
    B.tools.toast(g.name + ' moved to the ' + f.where.toLowerCase());
  }

  function render(el) {
    const v = violations();
    el.innerHTML = `<h4>Hazardous materials rules</h4><p>The cage is checked against segregation rules for incompatible materials. Each storage group is one bund or rack; the check measures the clear gap between them.</p>
      <div class="row2"><div class="stat"><b style="color:${v.length ? 'var(--bad)' : 'var(--ok)'}">${v.length}</b><small>rule breaches</small></div><div class="stat"><b>${groups.length}</b><small>storage groups checked</small></div></div>
      ${v.map((q) => `<div class="card hzv"><b>${P.esc(q.a.name)} and ${P.esc(q.b.name)}</b><p><span>${q.d.toFixed(1)} m apart, the rule needs ${q.need} m.</span> <span>${P.esc(q.why)}</span></p>
        <div class="btnrow">${[q.a, q.b].filter((g) => FIX[g.id] && !g.moved).map((g) => '<button class="btn primary" data-fix="' + g.id + '">Move ' + P.esc(g.name) + ' to the ' + P.esc(FIX[g.id].where.toLowerCase()) + '</button>').join('')}<button class="btn" data-look="1">Show in 3D</button></div></div>`).join('') ||
        '<p style="color:var(--ok)"><b>All clear.</b> No incompatible materials are stored too close together.</p>'}
      <h4>What is stored where</h4><table><thead><tr><th>Material</th><th>Hazard</th><th>Location</th></tr></thead><tbody>
      ${groups.map((g) => '<tr><td>' + P.esc(g.name) + '</td><td><i class="dot" style="background:' + CLASS[g.cls].color + '"></i>' + CLASS[g.cls].name + '<br><small>' + CLASS[g.cls].ghs + '</small></td><td>' + P.esc(g.where) + '</td></tr>').join('')}</tbody></table>
      <h4>Rules applied</h4><table><tbody>${RULES.map((r) => '<tr><td>' + CLASS[r[0]].name + ' and ' + CLASS[r[1]].name.toLowerCase() + '</td><td class="num">' + r[2] + ' m</td></tr>').join('')}</tbody></table>
      <div class="btnrow"><button class="btn" id="hzReset">Restore the original layout</button></div>`;
    el.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => fix(b.dataset.fix)));
    el.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => B.ui.flyTo([zn.x[0] - 6, 16, zn.z[1] + 12], [(zn.x[0] + zn.x[1]) / 2, 0, zn.z[1] - 8], 1.3)));
    el.querySelector('#hzReset').addEventListener('click', () => { groups = ORIGINAL(); draw(); render(el); });
  }
  const css = document.createElement('style');
  css.textContent = '.hzv { border-color: var(--bad) !important; display: grid; gap: 6px; } .hzv p { margin: 0; }';
  document.head.appendChild(css);
  draw();
  B.tools.add({ id: 'hazmat', label: 'Hazmat', render });
  B.hazmat = { violations, groups: () => groups, CLASS, fix, redraw: draw, spills, cabinet, warn };
})();
