/* Building 19 - layout editor: draw walkways on the floor and drag a double rack row with the mouse; the live simulation uses the new layout straight away */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, Wt = B.watch;
  const { renderer, scene, camera, controls } = B.three;
  const RACK = B.RACK, FACE = RACK.depth / 2, MIN_AISLE = 2.8;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const $ = (id) => document.getElementById(id);

  // ---------- the instanced rack parts are ordered row by row, so one row's instances can be shifted ----------
  const nR = RACK.rows.length;
  const rackMeshes = [];
  scene.traverse((o) => { if (o.isInstancedMesh && !o.userData.slotOf && o !== W.palletBase && o !== W.palletLoad) { const c = o.count; if (c === nR * (RACK.bays + 1) * 2 || c === nR * (RACK.bays + 1) * 6 || c === nR * (RACK.bays + 1) || c === nR * RACK.bays * RACK.levels * 2) rackMeshes.push(o); } });
  const M = new T.Matrix4(), SH = new T.Matrix4();
  function shiftRow(ri, dz) {
    SH.makeTranslation(0, 0, dz);
    rackMeshes.forEach((m) => {
      const per = m.count / nR;
      for (let i = ri * per; i < (ri + 1) * per; i++) { m.getMatrixAt(i, M); M.premultiply(SH); m.setMatrixAt(i, M); }
      m.instanceMatrix.needsUpdate = true;
    });
    const row = RACK.rows[ri];
    row.z += dz;
    endBars.forEach((g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - (row.z - dz)) < FACE + 0.3) p.setZ(i, p.getZ(i) + dz); p.needsUpdate = true; g.computeBoundingSphere(); });
  }
  // the end barriers were merged at load: their vertices move with the row
  const endBars = [];
  const endMat = W.mat('#f2b31b', { roughness: 0.5 });
  scene.traverse((o) => { if (o.isMesh && o.material === endMat && o.geometry.attributes.position.count > 24) endBars.push(o.geometry); });
  const aoPlanes = [];
  scene.traverse((o) => { const p = o.geometry && o.geometry.parameters; if (o.isMesh && p && p.width === RACK.bays * RACK.bayW + 1 && p.height === RACK.depth * 2 + RACK.back + 1.6) aoPlanes.push(o); });
  aoPlanes.sort((a, b) => a.position.z - b.position.z);

  // ---------- geometry of a double row and its aisles ----------
  const pairOf = (k) => [RACK.rows[2 * k], RACK.rows[2 * k + 1]];
  function limits(k) {
    const [a, b] = pairOf(k), lo = k > 0 ? RACK.rows[2 * k - 1].z + FACE + MIN_AISLE : B.LANES.front + 2.4 + FACE, hi = k < RACK.pairs - 1 ? RACK.rows[2 * k + 2].z - FACE - MIN_AISLE : B.LANES.back - 2.4 - FACE;
    return { min: lo - a.z, max: hi - b.z };
  }
  function aisles() {
    const out = [];
    for (let k = 0; k < RACK.pairs - 1; k++) out.push({ k, w: RACK.rows[2 * k + 2].z - RACK.rows[2 * k + 1].z - RACK.depth, label: RACK.rows[2 * k + 1].letter + '-' + RACK.rows[2 * k + 2].letter });
    return out;
  }
  // average one-way drive from the doors to a pallet in the racks
  function avgTravel() {
    let s = 0, n = 0;
    B.SLOTS.forEach((q, i) => { if (i % 7) return; const toIn = Math.abs(q.x - B.LANES.west) + Math.abs(q.access - B.LANES.front), toOut = Math.abs(q.x - B.LANES.east) + Math.abs(B.LANES.back - q.access); s += (toIn + toOut) / 2; n++; });
    return s / n;
  }
  const base = { travel: avgTravel(), z: RACK.rows.map((r) => r.z) };
  function freeDepth() { return (B.LANES.back - 2.4) - (RACK.rows[nR - 1].z + FACE); }
  function applyPair(k, dz) {
    if (Math.abs(dz) < 0.01) return;
    [2 * k, 2 * k + 1].forEach((ri) => shiftRow(ri, dz));
    B.SLOTS.forEach((s) => { if (s.row === 2 * k || s.row === 2 * k + 1) { s.z += dz; W.updateSlot(s, true); } });
    if (aoPlanes[k]) aoPlanes[k].position.z += dz;
    refreshAccess();
    W.flagPallets();
    W.buildLabels();
  }
  // the pick point sits in the middle of an aisle narrower than the standard 3.6 m
  function refreshAccess() {
    RACK.rows.forEach((row, ri) => {
      const south = ri % 2 === 1, other = RACK.rows[south ? ri + 1 : ri - 1];
      const width = other ? Math.abs(other.z - row.z) - RACK.depth : 3.6;
      const off = FACE + Math.min(1.8, width / 2);
      row.access = row.z + (south ? off : -off);
    });
    B.SLOTS.forEach((s) => { s.access = RACK.rows[s.row].access; });
  }

  // ---------- pointer tools ----------
  const ray = new T.Raycaster(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0), v2 = new T.Vector2(), hit = new T.Vector3();
  function floorAt(e) { const r = renderer.domElement.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, camera); return ray.ray.intersectPlane(floor, hit) ? { x: hit.x, z: hit.z } : null; }
  const ED = { mode: '', a: null, drag: null, added: 0, moves: 0 };
  const ghostMat = new T.MeshBasicMaterial({ color: '#39d1ff', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
  const ghostBad = new T.Color('#ff3b30'), ghostOk = new T.Color('#39d1ff');
  const ghost = new T.Mesh(new T.BoxGeometry(RACK.bays * RACK.bayW, RACK.levels * RACK.levelH, RACK.depth * 2 + RACK.back), ghostMat); ghost.visible = false; ghost.renderOrder = 9; scene.add(ghost);
  const preview = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#2fbf5a', transparent: true, opacity: 0.5, depthWrite: false, depthTest: false })); preview.rotation.x = -Math.PI / 2; preview.position.y = 0.06; preview.visible = false; preview.renderOrder = 10; scene.add(preview);
  function setMode(m) { ED.mode = ED.mode === m ? '' : m; ED.a = null; preview.visible = false; ghost.visible = false; controls.enabled = !ED.mode; renderer.domElement.style.cursor = ED.mode ? 'crosshair' : ''; if (B.tools.isOpen('layout')) B.tools.refresh(); B.ui.setView('top'); }
  const snapRect = (a, b, wd) => { const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z); const half = wd / 2; return dx >= dz ? { x: [Math.min(a.x, b.x), Math.max(a.x, b.x)], z: [a.z - half, a.z + half] } : { x: [a.x - half, a.x + half], z: [Math.min(a.z, b.z), Math.max(a.z, b.z)] }; };
  function setPreview(r) { preview.visible = true; preview.scale.set(Math.max(0.3, r.x[1] - r.x[0]), Math.max(0.3, r.z[1] - r.z[0]), 1); preview.position.set((r.x[0] + r.x[1]) / 2, 0.06, (r.z[0] + r.z[1]) / 2); }
  function addWalk(r) {
    Wt.extraWalks.push(r); Wt.paintWalk(r); ED.added += Math.max(r.x[1] - r.x[0], r.z[1] - r.z[0]);
    B.tools.toast('Walkway added. The cameras now count it as a safe path, so crossings here stop being flagged.');
    if (B.tools.isOpen('layout')) B.tools.refresh();
  }
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (ED.mode !== 'rack') return;
    const p = floorAt(e); if (!p) return;
    let best = -1, bd = 3;
    for (let k = 0; k < RACK.pairs; k++) { const [a, b] = pairOf(k), zc = (a.z + b.z) / 2, d = Math.abs(p.z - zc); if (d < bd && p.x > RACK.x0 - 4 && p.x < RACK.x0 + RACK.bays * RACK.bayW + 4) { bd = d; best = k; } }
    if (best >= 0) { const [a, b] = pairOf(best); ED.drag = { k: best, z0: p.z, dz: 0, lim: limits(best), zc: (a.z + b.z) / 2 }; ghost.visible = true; ghost.position.set(RACK.x0 + (RACK.bays * RACK.bayW) / 2, (RACK.levels * RACK.levelH) / 2, ED.drag.zc); ghostMat.color.copy(ghostOk); }
  });
  el.addEventListener('pointermove', (e) => {
    if (ED.mode === 'walk' && ED.a) { const p = floorAt(e); if (p) setPreview(snapRect(ED.a, p, 2)); }
    if (ED.mode === 'rack' && ED.drag) {
      const p = floorAt(e); if (!p) return;
      const want = p.z - ED.drag.z0, d = ED.drag;
      d.raw = want; d.dz = Math.max(d.lim.min, Math.min(d.lim.max, want));
      ghost.position.z = d.zc + want;
      ghostMat.color.copy(Math.abs(want - d.dz) > 0.05 ? ghostBad : ghostOk);
    }
  });
  el.addEventListener('pointerup', (e) => {
    if (ED.mode === 'walk') {
      const p = floorAt(e); if (!p) return;
      if (!ED.a) { ED.a = p; setPreview(snapRect(p, p, 2)); return; }
      const r = snapRect(ED.a, p, 2); ED.a = null; preview.visible = false;
      if (Math.max(r.x[1] - r.x[0], r.z[1] - r.z[0]) > 1.5) addWalk(r);
    }
    if (ED.mode === 'rack' && ED.drag) {
      const d = ED.drag; ED.drag = null; ghost.visible = false;
      if (Math.abs(d.dz) > 0.05) { applyPair(d.k, d.dz); ED.moves++; B.tools.toast('Rows ' + pairOf(d.k)[0].letter + pairOf(d.k)[1].letter + ' moved ' + fmt(d.dz, 1) + ' m. Forklifts now use the new position.'); }
      else if (Math.abs(d.raw || 0) > 0.05) B.tools.toast('That leaves an aisle under ' + MIN_AISLE + ' m, too narrow for a forklift.');
      if (B.tools.isOpen('layout')) B.tools.refresh();
    }
  });
  function reset() { for (let k = 0; k < RACK.pairs; k++) applyPair(k, base.z[2 * k] - RACK.rows[2 * k].z); ED.moves = 0; if (B.tools.isOpen('layout')) B.tools.refresh(); }

  function render(root) {
    const now = avgTravel(), as = aisles(), narrow = as.slice().sort((a, b) => a.w - b.w)[0], laneBefore = Wt.events.filter((e) => e.type === 'lane').length;
    root.innerHTML = `<h4>Layout editor</h4><p>Change the floor and watch the twin respond at once.</p>
      <div class="btnrow"><button class="btn ${ED.mode === 'walk' ? 'primary' : ''}" id="lyWalk">${ED.mode === 'walk' ? 'Finish drawing' : 'Draw a walkway'}</button><button class="btn ${ED.mode === 'rack' ? 'primary' : ''}" id="lyRack">${ED.mode === 'rack' ? 'Finish moving' : 'Move a rack row'}</button><button class="btn" id="lyReset" ${ED.moves ? '' : 'disabled'}>Put the racks back</button></div>
      <p>${ED.mode === 'walk' ? 'Click where the walkway starts, then where it ends. It snaps straight and is 2 m wide.' : ED.mode === 'rack' ? 'Drag a double row up or down the floor. Blue is allowed, red would leave an aisle too narrow.' : 'Choose a tool, then use the view from above.'}</p>
      <div class="row2"><div class="stat"><b>${fmt(now, 1)} m</b><small>average drive to a pallet (was ${fmt(base.travel, 1)} m)</small></div><div class="stat"><b>${fmt(narrow.w, 1)} m</b><small>narrowest aisle (${narrow.label}), minimum ${MIN_AISLE} m</small></div>
      <div class="stat"><b>${fmt(ED.added, 0)} m</b><small>of new walkway painted</small></div><div class="stat"><b>${fmt(laneBefore)}</b><small>path breaches detected so far</small></div></div>
      <h4>Aisle widths</h4><table><tbody>${as.map((q) => '<tr><td>Aisle ' + q.label + '</td><td class="num ' + (q.w < 3.2 ? 'bad' : '') + '">' + fmt(q.w, 1) + ' m</td></tr>').join('')}</tbody></table>
      <p>Racks shift as whole double rows and stay within the building. Slot positions, pick points and forklift routes all follow. Racks are moved in the model only; real moves need a structural check.</p>`;
    root.querySelector('#lyWalk').addEventListener('click', () => setMode('walk'));
    root.querySelector('#lyRack').addEventListener('click', () => setMode('rack'));
    root.querySelector('#lyReset').addEventListener('click', reset);
  }
  B.tools.add({ id: 'layout', label: 'Layout editor', render });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ED.mode) setMode(ED.mode); });
  B.layout = { setMode, applyPair, reset, addWalk, avgTravel, aisles, limits, state: ED, rackMeshes, base };
})();
