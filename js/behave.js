/* Building 19 - real handling and behaviour: dock forklifts unload trucks pallet by pallet, people take real breaks and stop at crossings, forklifts get a pre-shift check, every worker differs */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors, P = B.panel;
  const { scene } = B.three;
  const R = B.rng(1212);
  const L = B.LANES;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // ---------- every driver and worker differs ----------
  function skillUp(f) {
    if (f.skill) return;
    f.exp = 1 + Math.floor(R() * 14);
    f.skill = 0.86 + (f.exp / 14) * 0.24 + (R() - 0.5) * 0.04;
    f.rush = f.exp < 4 ? 1.5 : f.exp > 10 ? 0.6 : 1;
  }
  A.list.filter((a) => a.kind === 'person').forEach((a) => { const k = 0.88 + R() * 0.24; a.speed *= k; a.pace = k; });

  // ---------- dock forklifts: the truck's unloading cycle, one pallet each 2 minutes, drawn for real ----------
  const dock = new Map();
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (a, b, k) => ({ x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k) });
  const ease = (k) => k * k * (3 - 2 * k);
  function dockFor(door) {
    if (dock.has(door)) return dock.get(door);
    const mesh = W.makeForklift('D');
    const op = A.makePerson({ height: 1.7, girth: 0.95, skin: '#a8754f', shirt: A.CLOTH.beige, pants: A.CLOTH.black, vest: true, hat: 'helmet', hatColor: '#f4f4f0' });
    op.position.set(0, 0.62, 0.5); op.scale.setScalar(0.96); mesh.add(op);
    const u = op.userData; u.legL.rotation.x = u.legR.rotation.x = -1.3; u.armL.rotation.x = u.armR.rotation.x = -0.9;
    mesh.position.set(door.x + 3.2, 0, door.z + door.dir * 3.8);
    mesh.rotation.y = door.dir > 0 ? Math.PI : 0;
    W.mergeStatic(op); mesh.traverse((o) => (o.castShadow = false));
    scene.add(mesh);
    const q = { door, mesh, load: null, cyc: -1, reversing: false, p: null };
    dock.set(door, q);
    return q;
  }
  function attach(q, item) { if (q.load) return; const p = W.makePallet(item); p.position.set(0, 0.06, -0.62); q.mesh.userData.car.add(p); q.load = p; }
  function detach(q) { if (q.load) q.mesh.userData.car.remove(q.load); q.load = null; }
  function opening(tr) {
    if (tr.opening) return tr.opening;
    const g = new T.Group();
    const hole = new T.Mesh(new T.PlaneGeometry(2.3, 2.6), new T.MeshBasicMaterial({ color: '#0b0d10', toneMapped: false })); hole.position.set(0, 2.55, 0.09);
    const flo = new T.Mesh(new T.BoxGeometry(2.2, 0.03, 0.5), W.mat('#3b3127')); flo.position.set(0, 1.28, 0.1);
    const doorMat = W.mat('#e9ebee', { roughness: 0.5 });
    [-1, 1].forEach((s) => { const d = new T.Mesh(new T.BoxGeometry(1.15, 2.6, 0.05), doorMat); d.position.set(s * 1.86, 2.55, -0.55); d.rotation.y = s * 1.45; g.add(d); });
    g.add(hole, flo); tr.mesh.add(g); tr.opening = g;
    return g;
  }
  function place(q, pos, headX, headZ, y) {
    q.mesh.position.set(pos.x, y || 0, pos.z);
    const want = Math.atan2(-headX, -headZ);
    let d = want - q.mesh.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    q.mesh.rotation.y += d * 0.35;
  }
  function updateDock() {
    dock.forEach((q) => { q.active = false; });
    S.trucks.forEach((tr) => {
      const door = tr.door, q = dockFor(door);
      q.active = true;
      if (tr.phase !== 'work') { q.reversing = false; if (tr.opening) tr.opening.visible = false; return; }
      opening(tr).visible = tr.timer > -240;
      const dir = door.dir;
      const S0 = { x: door.x, z: door.z + dir * 3.6 }, IN = { x: door.x, z: door.z - dir * 5.5 };
      const inb = tr.dir === 'in';
      if (tr.timer < 0 || (inb && tr.done >= tr.count)) { q.reversing = false; detach(q); const k = clamp01(-tr.timer / 300); if (tr.timer >= 0) return; place(q, { x: door.x + 3.2, z: door.z + dir * 3.8 }, 0, -dir * 0.0 + (dir > 0 ? 1 : -1)); return; }
      const k = clamp01(tr.timer / 120);
      const key = tr.done + (tr.dir === 'in' ? 100 : 200);
      if (q.cyc !== key) { q.cyc = key; q.spot = inb ? (W.stageIn.find((p) => p.door === door && !p.used) || W.stageIn.find((p) => !p.used)) : (tr.order && tr.order.pos[tr.done]); q.item = Math.floor(R() * B.ITEMS.length); q.lifted = false; detach(q); }
      const p = q.spot; if (!p) return;
      const AP = { x: p.x, z: p.z - dir * 2.2 };
      const ramp = (pos) => { const dz = (pos.z - door.z) * dir; return 1.17 * ease(clamp01((2.6 - dz) / 2.6)); }; // up the leveller into the trailer
      const car = q.mesh.userData.car;
      q.reversing = false;
      let pos = S0, hx = 0, hz = -dir;
      if (inb) {
        if (k < 0.28) { pos = seg(S0, IN, ease(k / 0.28)); }
        else if (k < 0.38) { pos = IN; if (k > 0.33) attach(q, q.item); car.position.y = 0.12 + clamp01((k - 0.28) / 0.1) * 0.14; }
        else if (k < 0.6) { pos = seg(IN, S0, ease((k - 0.38) / 0.22)); q.reversing = true; attach(q, q.item); }
        else if (k < 0.82) { pos = seg(S0, AP, ease((k - 0.6) / 0.22)); hx = AP.x - S0.x; hz = AP.z - S0.z; attach(q, q.item); }
        else if (k < 0.94) { pos = AP; hx = 0; hz = dir; car.position.y = Math.max(0.12, 0.26 - (k - 0.82)); if (k > 0.9) detach(q); }
        else { pos = seg(AP, S0, ease((k - 0.94) / 0.06)); hx = 0; hz = dir; q.reversing = true; detach(q); }
      } else {
        if (k < 0.2) { pos = seg(S0, AP, ease(k / 0.2)); hx = AP.x - S0.x; hz = AP.z - S0.z; }
        else if (k < 0.3) { pos = AP; hx = 0; hz = dir; if (k > 0.25 && !q.lifted) { q.lifted = true; attach(q, q.item); if (p.used) p.used.visible = false; } }
        else if (k < 0.45) { pos = seg(AP, S0, ease((k - 0.3) / 0.15)); hx = 0; hz = dir; q.reversing = true; attach(q, q.item); }
        else if (k < 0.7) { pos = seg(S0, IN, ease((k - 0.45) / 0.25)); attach(q, q.item); }
        else if (k < 0.8) { pos = IN; if (k > 0.76) detach(q); }
        else { pos = seg(IN, S0, ease((k - 0.8) / 0.2)); q.reversing = true; detach(q); }
      }
      place(q, pos, hx, hz, ramp(pos));
    });
    dock.forEach((q) => { if (!q.active) { q.reversing = false; detach(q); q.cyc = -1; const d = q.door; q.mesh.position.set(d.x + 3.2, 0, d.z + d.dir * 3.8); } q.mesh.visible = q.active && q.mesh.position.distanceTo(B.three.camera.position) < 150; });
  }

  // ---------- rest area between the small parts store and the hazmat cage ----------
  const REST = { x: 52, z: 0 };
  (function restArea() {
    const g = new T.Group();
    const canopy = new T.Mesh(new T.BoxGeometry(12, 0.12, 5), W.mat('#3d7b8f', { roughness: 0.55 })); canopy.position.set(REST.x + 1, 3, REST.z); g.add(canopy);
    [[-5, -2.2], [7, -2.2], [-5, 2.2], [7, 2.2]].forEach(([x, z]) => { const p = W.box(0.1, 3, 0.1, '#59626b'); p.position.set(REST.x + x, 1.5, REST.z + z); g.add(p); });
    const seat = W.box(6, 0.1, 0.5, '#8a6a44'); seat.position.set(REST.x, 0.46, REST.z - 1.1); g.add(seat);
    [-2.8, 0, 2.8].forEach((x) => { const leg = W.box(0.1, 0.46, 0.45, '#3a3f45'); leg.position.set(REST.x + x, 0.23, REST.z - 1.1); g.add(leg); });
    const table = W.box(3, 0.08, 0.9, '#d9d4c9'); table.position.set(REST.x, 0.78, REST.z + 0.3); g.add(table);
    const leg = W.box(0.14, 0.76, 0.14, '#3a3f45'); leg.position.set(REST.x, 0.38, REST.z + 0.3); g.add(leg);
    const cool = W.box(0.42, 1.25, 0.42, '#e9ecef'); cool.position.set(REST.x - 4.2, 0.62, REST.z + 1.5); const bottle = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.42, 14), new T.MeshStandardMaterial({ color: '#7cc4e8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 })); bottle.position.set(REST.x - 4.2, 1.45, REST.z + 1.5); g.add(cool, bottle);
    const lbl = W.makeLabel('Rest area', { size: 1, stripe: '#3d7b8f' }); lbl.position.set(REST.x, 3.7, REST.z); g.add(lbl);
    scene.add(g);
  })();

  // ---------- people: real breaks, crossings ----------
  let seats = 0;
  function breakPath(a) {
    const pts = [];
    if (a.x < 43) { const zz = a.z > 18 ? a.z : -25.2; pts.push({ x: a.x, z: zz }, { x: 44.8, z: zz }); }
    pts.push({ x: 44.8, z: 0 }, { x: 47.6, z: 0 });
    a.brkSeat = { x: REST.x - 2.4 + (seats++ % 5) * 1.2, z: REST.z - 0.72 };
    pts.push({ x: a.brkSeat.x, z: REST.z + 0.5 }, a.brkSeat);
    return pts;
  }
  function walkTo(a, dt, list) {
    const u = a.mesh.userData, p = list[0];
    if (!p) return true;
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), st = a.speed * dt;
    if (d <= st) { a.x = p.x; a.z = p.z; list.shift(); } else { a.x += (dx / d) * st; a.z += (dz / d) * st; a.head = Math.atan2(dx, dz); }
    a.phase += dt * a.speed * 5.2;
    const sw = Math.sin(a.phase) * 0.5;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.25;
    a.mesh.position.set(a.x, Math.abs(Math.sin(a.phase)) * 0.03, a.z);
    let r = a.head - a.mesh.rotation.y; while (r > Math.PI) r -= Math.PI * 2; while (r < -Math.PI) r += Math.PI * 2; a.mesh.rotation.y += r * Math.min(1, dt * 6);
    return list.length === 0;
  }
  function breakLogic(a, dt) {
    const breakNow = B.env && B.env.onBreak();
    if (!a.brk && breakNow) { a.brk = 'go'; a.brkFrom = { x: a.x, z: a.z }; a.brkPath = breakPath(a); a.onBreakWalk = true; a.brkBack = a.brkPath.slice(0, -1).reverse().concat([a.brkFrom]); }
    if (!a.brk) return false;
    const u = a.mesh.userData;
    if (a.brk === 'go') { a.status = 'Walking to the rest area'; if (walkTo(a, dt, a.brkPath)) a.brk = 'sit'; return true; }
    if (a.brk === 'sit') {
      a.status = 'On a meal break';
      u.legL.rotation.x = u.legR.rotation.x = -1.45; u.armL.rotation.x = u.armR.rotation.x = -0.45; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.9;
      a.head = 0; let r = 0 - a.mesh.rotation.y; while (r > Math.PI) r -= Math.PI * 2; while (r < -Math.PI) r += Math.PI * 2; a.mesh.rotation.y += r * Math.min(1, dt * 4);
      a.mesh.position.set(a.x, -0.36 * u.s, a.z);
      if (!breakNow) { a.brk = 'back'; a.brkPath = a.brkBack; }
      return true;
    }
    a.status = 'Returning to work';
    if (walkTo(a, dt, a.brkPath)) { a.brk = null; a.onBreakWalk = false; }
    return true;
  }
  function crossing(a, dt) {
    if (a.wait > 0) return;
    const p = a.route[a.i]; if (!p) return;
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const towards = (Math.abs(uz) > 0.7 && [L.front, L.back].some((zl) => Math.abs(a.z - zl) < 2.8 && (zl - a.z) * uz >= -0.3)) || (Math.abs(ux) > 0.7 && [L.west, L.east].some((xl) => Math.abs(a.x - xl) < 2.8 && (xl - a.x) * ux >= -0.3));
    if (!towards) return;
    const near = S.forklifts.some((f) => f.path && f.path.length && !f.lift && !f.down && Math.hypot(f.x - a.x, f.z - a.z) < 6.5);
    if (near) { a.wait = 0.4; a.crossT = (a.crossT || 0) + dt; a.status = 'Waiting at the crossing'; }
  }
  A.list.filter((a) => a.route).forEach((a) => {
    const base = a.update;
    a.update = (q, dt) => {
      if (B.evac && B.evac.active()) return base(q, dt);
      if (breakLogic(q, dt)) return;
      crossing(q, dt);
      base(q, dt);
    };
  });

  // ---------- pre-shift forklift check: the driver walks round the truck before the first task ----------
  const shiftOf = () => { const h = ((S.st.t / 3600) % 24 + 24) % 24; return Math.floor((((h - 7 + 24) % 24)) / 8) + Math.floor(S.st.t / 86400) * 3; };
  const insp = new Map();
  function inspect(dt) {
    const sh = shiftOf(), elapsed = (((S.st.t / 3600) % 24 + 24 - 7) % 8) * 3600;
    S.forklifts.forEach((f) => {
      skillUp(f);
      const q = insp.get(f);
      if (f.phase === 'inspect') {
        if (q) {
          q.a += dt * 0.5 * (f.skill || 1);
          const u = q.g.userData, sw = Math.sin(q.a * 7) * 0.45, stop = Math.sin(q.a * 0.9) > 0.65;
          q.g.position.set(f.x + Math.cos(q.a) * 2.1, 0, f.z + Math.sin(q.a) * 2.3);
          q.g.rotation.y = stop ? Math.atan2(f.x - q.g.position.x, f.z - q.g.position.z) : -q.a;
          u.legL.rotation.x = stop ? 0 : sw; u.legR.rotation.x = stop ? 0 : -sw; u.armR.rotation.x = -0.9; u.elbowR.rotation.x = -1.1;
        }
        if (S.st.t >= f.inspectEnd) { f.phase = 'idle'; end(f); }
      } else if (f.inspected !== sh && elapsed < 900 && f.phase === 'idle' && !f.task && !f.down && !f.needCharge) {
        f.inspected = sh; f.phase = 'inspect'; f.inspectEnd = S.st.t + 150 + R() * 90;
        const g = A.makePerson({ height: 1.72, girth: 1, skin: '#a8754f', shirt: A.CLOTH.beige, pants: A.CLOTH.black, vest: true, hat: 'helmet', hatColor: '#f4f4f0' });
        const board = W.box(0.22, 0.3, 0.02, '#e6e1d3'); board.position.set(0, -0.3, 0.08); g.userData.elbowR.add(board);
        g.traverse((o) => (o.castShadow = false)); scene.add(g); insp.set(f, { g, a: R() * 6 });
        if (f.mesh.userData.op) f.mesh.userData.op.visible = false;
      } else if (q) end(f);
    });
  }
  function end(f) { const q = insp.get(f); if (q) { scene.remove(q.g); insp.delete(f); } if (f.mesh.userData.op) f.mesh.userData.op.visible = true; }
  const describe = S.describeForklift;
  S.describeForklift = (n) => { const d = describe(n); if (d && d.f.phase === 'inspect') d.status = 'Pre-shift inspection'; return d; };

  // the forklift card shows the driver's experience and pace (drivers are not named)
  const showF = P.showForklift;
  P.showForklift = function (n) {
    showF(n);
    const f = S.forklifts.find((q) => q.n === n), dl = document.querySelector('#details dl.kv');
    if (f && f.exp && dl) dl.insertAdjacentHTML('beforeend', '<dt>Driver experience</dt><dd>' + f.exp + ' years</dd><dt>Driver pace</dt><dd>' + Math.round(f.skill * 100) + '% of the fleet standard</dd>');
  };

  B.hooks.frame.push(() => {
    if (!S.st.running) return;
    const sdt = S.st.t - (B.behave.lastT || S.st.t);
    B.behave.lastT = S.st.t;
    updateDock();
    inspect(Math.max(0, sdt));
  });
  S.forklifts.forEach(skillUp);
  B.behave = { REST, dock, inspect, lastT: 0, inspecting: () => insp.size };
  B.dockwork = { get list() { return [...dock.values()]; } };
})();
