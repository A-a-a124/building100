/* Building 100 - safety: forklifts give way and yield to people, near-miss counter, congestion heatmap, live route lines */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const opts = { yieldPeople: true, giveWay: true };
  S.st.nearMiss = 0; S.st.yields = 0;
  const lastMiss = new Map();

  // ---------- give way / yield ----------
  function blocked(f, dt) {
    if (f.waitT < 0) { f.waitT += dt; return false; } // short grace after forcing through a stand-off
    const p = f.path[0];
    if (!p) return false;
    let dx = p.x - f.x, dz = p.z - f.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return false;
    dx /= d; dz /= d;
    let why = '';
    if (opts.giveWay) for (const g of S.forklifts) {
      if (g === f) continue;
      const ox = g.x - f.x, oz = g.z - f.z, dist = Math.hypot(ox, oz);
      if (dist > 0.01 && dist < 3.4 && (ox * dx + oz * dz) / dist > 0.55) {
        const gMoving = g.path && g.path.length && !g.lift;
        if (!gMoving || f.n > g.n) { why = 'Giving way to forklift ' + g.n; break; }
      }
    }
    if (!why && opts.yieldPeople) for (const a of B.actors.list) {
      if (a.kind !== 'person') continue;
      const ox = a.x - f.x, oz = a.z - f.z, dist = Math.hypot(ox, oz);
      if (dist > 0.01 && dist < 2.8 && (ox * dx + oz * dz) / dist > 0.45) { why = 'Stopped for ' + (a.anon ? 'a worker' : a.name); break; }
    }
    if (why) {
      if (!f.yieldWhy) S.st.yields++;
      f.yieldWhy = why;
      f.waitT = (f.waitT || 0) + dt;
      if (f.waitT > 5) { f.waitT = -2.5; f.yieldWhy = ''; return false; }
      return true;
    }
    f.yieldWhy = ''; f.waitT = 0;
    return false;
  }
  // forklift card shows why it stopped and how far it drove
  const describe = S.describeForklift;
  S.describeForklift = (n) => {
    const d = describe(n);
    if (!d) return d;
    if (d.f.yieldWhy) d.status = d.f.yieldWhy;
    d.taskDist = d.f.taskDist || 0;
    d.dist = d.f.dist || 0;
    return d;
  };

  // ---------- near misses ----------
  const rings = [];
  function flash(x, z) {
    const m = new T.Mesh(new T.RingGeometry(0.8, 1.15, 40), new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, side: T.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.09, z);
    W.scene.add(m); rings.push({ m, t: 0 });
  }
  function zoneAt(x, z) { const zn = B.ZONES.find((q) => x >= q.x[0] && x <= q.x[1] && z >= q.z[0] && z <= q.z[1]); return zn ? zn.name : 'the main floor'; }
  function checkNearMisses() {
    for (const f of S.forklifts) {
      if (!f.path || !f.path.length || f.lift) continue;
      for (const a of B.actors.list) {
        if (a.kind !== 'person' || Math.hypot(a.x - f.x, a.z - f.z) > 1.5) continue;
        const key = f.n + '|' + a.id;
        if (S.st.t - (lastMiss.get(key) || -1e9) < 30) continue;
        lastMiss.set(key, S.st.t);
        S.st.nearMiss++;
        flash((a.x + f.x) / 2, (a.z + f.z) / 2);
        S.addLog('Near miss: forklift ' + f.n + ' and ' + (a.anon ? 'a worker' : a.name) + ' in ' + zoneAt(a.x, a.z), 'warn');
      }
    }
  }

  // ---------- congestion heatmap ----------
  const GX0 = -72, GZ0 = -42, CELL = 2, NX = 96, NZ = 42;
  const grid = new Float32Array(NX * NZ);
  const canvas = document.createElement('canvas'); canvas.width = NX; canvas.height = NZ;
  const tex = new T.CanvasTexture(canvas);
  const heat = new T.Mesh(new T.PlaneGeometry(NX * CELL, NZ * CELL), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  heat.rotation.x = -Math.PI / 2; heat.position.set(GX0 + (NX * CELL) / 2, 0.07, GZ0 + (NZ * CELL) / 2); heat.visible = false; heat.renderOrder = 6;
  W.scene.add(heat);
  const cellOf = (x, z) => { const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL); return i >= 0 && i < NX && j >= 0 && j < NZ ? j * NX + i : -1; };
  function accumulate(dt) {
    S.forklifts.forEach((f) => { if (f.path && f.path.length) { const c = cellOf(f.x, f.z); if (c >= 0) grid[c] += dt; } });
    B.actors.list.forEach((a) => { if (a.kind === 'person') { const c = cellOf(a.x, a.z); if (c >= 0) grid[c] += dt * 0.5; } });
  }
  function paint() {
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(NX, NZ);
    // spread each cell into its neighbours so busy lanes read as bands, not dots
    const sm = new Float32Array(grid.length);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      let s = 0, w = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a >= 0 && a < NX && b >= 0 && b < NZ) { const k = 1 / (1 + di * di + dj * dj); s += grid[b * NX + a] * k; w += k; } }
      sm[j * NX + i] = s / w;
    }
    let max = 0; for (const v of sm) max = Math.max(max, v);
    for (let k = 0; k < sm.length; k++) {
      const v = max ? Math.pow(sm[k] / max, 0.45) : 0, o = k * 4;
      img.data[o] = 255; img.data[o + 1] = Math.round(225 * (1 - v)); img.data[o + 2] = 30; img.data[o + 3] = v < 0.08 ? 0 : Math.round(70 + 165 * v);
    }
    ctx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }
  function hotZones() {
    const sums = B.ZONES.map((zn) => {
      let s = 0;
      for (let x = zn.x[0]; x < zn.x[1]; x += CELL) for (let z = zn.z[0]; z < zn.z[1]; z += CELL) { const c = cellOf(x, z); if (c >= 0) s += grid[c]; }
      return { name: zn.name, s };
    });
    let lanes = 0; for (const v of grid) lanes += v;
    lanes -= sums.reduce((n, q) => n + q.s, 0);
    sums.push({ name: 'Lanes and aisles between zones', s: lanes });
    const tot = sums.reduce((n, q) => n + q.s, 0) || 1;
    return sums.sort((a, b) => b.s - a.s).slice(0, 4).map((q) => ({ name: q.name, pct: (q.s / tot) * 100 }));
  }

  // ---------- route lines ----------
  const routes = new T.Group(); routes.visible = false; W.scene.add(routes);
  const lines = new Map();
  function updateRoutes() {
    S.forklifts.forEach((f) => {
      let ln = lines.get(f);
      if (!ln) {
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(12 * 3), 3));
        ln = new T.Line(g, new T.LineBasicMaterial({ color: new T.Color().setHSL((f.n * 0.13) % 1, 0.85, 0.55) }));
        lines.set(f, ln); routes.add(ln);
      }
      const pts = [{ x: f.x, z: f.z }].concat(f.path || []).slice(0, 12), arr = ln.geometry.attributes.position.array;
      pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = 0.12; arr[i * 3 + 2] = p.z; });
      ln.geometry.setDrawRange(0, pts.length); ln.geometry.attributes.position.needsUpdate = true;
      ln.visible = pts.length > 1;
    });
    lines.forEach((ln, f) => { if (!S.forklifts.includes(f)) { routes.remove(ln); lines.delete(f); } });
  }

  // ---------- frame hook ----------
  let paintT = 0;
  B.hooks.frame.push((dt) => {
    if (S.st.running) { checkNearMisses(); accumulate(dt * S.st.speed); }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt;
      r.m.scale.setScalar(1 + r.t * 2); r.m.material.opacity = Math.max(0, 1 - r.t / 1.6);
      if (r.t > 1.6) { W.scene.remove(r.m); rings.splice(i, 1); }
    }
    if (heat.visible && (paintT += dt) > 1) { paintT = 0; paint(); }
    if (routes.visible) updateRoutes();
  });

  // layer toggles beside the existing ones
  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyCong">Congestion heatmap</label><label><input type="checkbox" id="lyRoutes">Forklift routes</label>');
  document.getElementById('lyCong').addEventListener('change', (e) => { heat.visible = e.target.checked; if (heat.visible) paint(); });
  document.getElementById('lyRoutes').addEventListener('change', (e) => (routes.visible = e.target.checked));

  function render(el) {
    const fmt = B.tools.fmt, km = S.forklifts.reduce((n, f) => n + (f.dist || 0), 0) / 1000, hz = hotZones();
    el.innerHTML = `<h4>Safety on the floor</h4><p>Forklifts give way to each other at crossings and stop for anyone on foot in front of them. A near miss is logged when a moving forklift comes within 1.5 m of a person.</p>
      <div class="row2"><div class="stat"><b>${S.st.nearMiss}</b><small>near misses this session</small></div><div class="stat"><b>${fmt(S.st.yields)}</b><small>times a forklift stopped or gave way</small></div>
      <div class="stat"><b>${fmt(km, 1)} km</b><small>driven by the fleet</small></div><div class="stat"><b>${S.forklifts.length}</b><small>forklifts on shift</small></div></div>
      <label><input type="checkbox" id="sfPeople" ${opts.yieldPeople ? 'checked' : ''}> Forklifts stop for people on foot</label>
      <label><input type="checkbox" id="sfWay" ${opts.giveWay ? 'checked' : ''}> Forklifts give way to each other</label>
      <p>Turn the first option off to see how many near misses happen without it.</p>
      <h4>Busiest areas</h4><table><tbody>${hz.map((q) => '<tr><td>' + B.panel.esc(q.name) + '</td><td class="num">' + fmt(q.pct, 0) + '%</td></tr>').join('')}</tbody></table>
      <div class="btnrow"><button class="btn" id="sfHeat">Show congestion heatmap</button><button class="btn" id="sfRoutes">Show forklift routes</button></div>`;
    el.querySelector('#sfPeople').addEventListener('change', (e) => (opts.yieldPeople = e.target.checked));
    el.querySelector('#sfWay').addEventListener('change', (e) => (opts.giveWay = e.target.checked));
    el.querySelector('#sfHeat').addEventListener('click', () => { const c = document.getElementById('lyCong'); c.checked = true; c.dispatchEvent(new Event('change')); B.ui.setView('top'); });
    el.querySelector('#sfRoutes').addEventListener('click', () => { const c = document.getElementById('lyRoutes'); c.checked = true; c.dispatchEvent(new Event('change')); });
  }
  B.tools.add({ id: 'safety', label: 'Safety', render });
  B.safety = { blocked, opts };
})();
