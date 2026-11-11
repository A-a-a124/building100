/* Building 19 - Safety Watch: cameras on the floor, simulated AI detections checked against the live positions, walkways and the rules they enforce */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors;
  const { renderer, scene, camera, stage } = B.three;
  const R = B.rng(1999);
  const { merge, mt } = B.loads;

  // ---------- rule types ----------
  const TYPES = {
    lane: { name: 'Outside the pedestrian path', points: 2, color: '#f2b31b' },
    helmet: { name: 'No helmet', points: 3, color: '#ff8a1f' },
    vest: { name: 'No safety vest', points: 2, color: '#ff8a1f' },
    phone: { name: 'Phone use while moving', points: 3, color: '#ff8a1f' },
    speed: { name: 'Forklift over the speed limit', points: 4, color: '#ff5a3c' },
    close: { name: 'Person and forklift too close', points: 5, color: '#ff5a3c' },
    hazmat: { name: 'Entered the hazmat cage without a permit', points: 6, color: '#ff3b30' },
    exit: { name: 'Fire exit blocked', points: 6, color: '#ff3b30' },
    forks: { name: 'Standing under raised forks', points: 8, color: '#ff1f4b' },
  };
  const SPEED_LIMIT = 3.9; // m/s, about 14 km/h
  // how often each person bends a rule, per simulated hour; the numbers only shape the simulated data
  const HABIT = { mansour: 1.7, mohsen: 1.25, w1: 0.95, w2: 1.1, w3: 0.85, ghazi: 0.08, abdullah: 0.12 };

  // ---------- pedestrian walkways: the same rectangles are painted on the floor and checked by the cameras ----------
  const WALKS = [
    { id: 'east', name: 'East walkway', x: [43, 47.2], z: [-34, 33.5] },
    { id: 'north', name: 'North walkway', x: [-58, 47.2], z: [-26.2, -24.2] },
    { id: 'south', name: 'South walkway', x: [2, 47.2], z: [29.8, 33.5] },
  ];
  const ALLOWED = [
    { x: [47, 51], z: [-36, -3] }, { x: [-48.5, -36.5], z: [-32.5, -24] }, { x: [-55.5, -52.5], z: [-26.2, -17.5] }, // pick and drop points
    { x: [-8.5, 0], z: [-29.6, -24] }, // office door
    { x: [47, 58], z: [-3, 3] }, // rest area
    { x: [-20, -4], z: [-38, -29] }, // office
  ];
  const inCage = (x, z) => x > 47.4 && x < 66 && z > 3.2 && z < 37;
  const inRect = (r, x, z) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];
  const onPath = (x, z) => WALKS.some((r) => inRect(r, x, z)) || ALLOWED.some((r) => inRect(r, x, z)) || extraWalks.some((r) => inRect(r, x, z));
  const extraWalks = [];

  const walkMat = new T.MeshBasicMaterial({ color: '#2f9e5b', transparent: true, opacity: 0.34, depthWrite: false });
  const walkEdge = new T.MeshBasicMaterial({ color: '#e9f6ee', transparent: true, opacity: 0.85, depthWrite: false });
  const walkGroup = new T.Group(); scene.add(walkGroup);
  const walkIcon = B.loads.canvas(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 26, 13, 0, 7); g.fill(); g.lineCap = 'round'; g.lineWidth = 15; g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 46); g.lineTo(64, 82); g.moveTo(64, 82); g.lineTo(44, 116); g.moveTo(64, 82); g.lineTo(84, 116); g.moveTo(42, 66); g.lineTo(64, 52); g.lineTo(88, 68); g.stroke(); });
  const iconMat = new T.MeshBasicMaterial({ map: walkIcon, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  function paintWalk(r) {
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, edges = [], icons = [];
    const plane = (ww, dd, x, z, y) => [new T.PlaneGeometry(ww, dd), mt(x, y, z, 1, 1, 1, -Math.PI / 2)];
    edges.push(plane(w, 0.12, cx, r.z[0], 0.032), plane(w, 0.12, cx, r.z[1], 0.032), plane(0.12, d, r.x[0], cz, 0.032), plane(0.12, d, r.x[1], cz, 0.032));
    const n = Math.floor(Math.max(w, d) / 16);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; icons.push(plane(1.3, 1.3, w > d ? r.x[0] + w * t : cx, w > d ? cz : r.z[0] + d * t, 0.034)); }
    [[[plane(w, d, cx, cz, 0.03)], walkMat], [edges, walkEdge], [icons, iconMat]].forEach(([list, m]) => { if (!list.length) return; const p = new T.Mesh(merge(list), m); p.renderOrder = 2; walkGroup.add(p); });
  }
  WALKS.forEach(paintWalk);

  // ---------- cameras ----------
  const CAMS = [
    ['CAM-01', 'Receiving doors', [-58, 8.5, -30], [-42, 0, -36]],
    ['CAM-02', 'Receiving lane', [-30, 8.5, -30], [-50, 0, -27]],
    ['CAM-03', 'North lane west', [-30, 9, -22], [-4, 0, -27]],
    ['CAM-04', 'North lane east', [38, 9, -22], [14, 0, -27]],
    ['CAM-05', 'Office and chargers', [-8, 9, -24.5], [2, 0, -33]],
    ['CAM-06', 'East walkway north', [47, 9, -32], [44, 0, -10]],
    ['CAM-07', 'East walkway south', [47, 9, 32], [44, 0, 8]],
    ['CAM-08', 'Hazmat cage gate', [44, 9, 3], [54, 0, 16]],
    ['CAM-09', 'Shipping lanes east', [38, 9, 28], [20, 0, 33]],
    ['CAM-10', 'Shipping lanes west', [-24, 9, 28], [0, 0, 33]],
    ['CAM-11', 'West lane and pipe yard', [-39, 9, 27], [-37, 0, -2]],
    ['CAM-12', 'Rack aisles from the east', [39.5, 9.5, 1], [10, 0, 1]],
    ['CAM-13', 'Rack aisles from the west', [-35, 9.5, -8], [0, 0, -8]],
    ['CAM-14', 'Small parts store', [47, 8, -2], [54, 0, -20]],
    ['CAM-15', 'Quality inspection', [-44, 7, -24], [-56, 0, -16]],
    ['CAM-16', 'Rack aisles south', [-2, 9.5, 27], [-2, 0, 5]],
  ].map(([id, name, pos, look]) => ({ id, name, pos, look }));
  const rigGroup = new T.Group(); scene.add(rigGroup);
  const coneGroup = new T.Group(); coneGroup.visible = false; scene.add(coneGroup);
  const camBody = merge([[new T.BoxGeometry(0.26, 0.2, 0.52), mt(0, 0, 0.1), '#eef0f2'], [new T.CylinderGeometry(0.075, 0.09, 0.08, 12), mt(0, 0, 0.4, 1, 1, 1, Math.PI / 2), '#111418'], [new T.BoxGeometry(0.34, 0.03, 0.6), mt(0, 0.12, 0.1), '#d4d8dc']]);
  const camMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
  const ledMat = new T.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
  CAMS.forEach((c) => {
    c.cam = new T.PerspectiveCamera(56, 16 / 9, 0.3, 130);
    c.cam.position.set(...c.pos); c.cam.lookAt(...c.look); c.cam.updateMatrixWorld(true); c.cam.updateProjectionMatrix();
    // view cone reaching the floor
    const d = new T.Vector3(...c.look).sub(new T.Vector3(...c.pos)), len = d.length(), hw = Math.tan((56 / 2) * Math.PI / 180) * len;
    const verts = [[0, 0, 0], [-hw * 1.5, -hw * 0.85, len], [hw * 1.5, -hw * 0.85, len], [hw * 1.5, hw * 0.85, len], [-hw * 1.5, hw * 0.85, len]];
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(verts.flat()), 3)); geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]); geo.computeVertexNormals();
    const cone = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#39d1ff', transparent: true, opacity: 0.09, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
    cone.position.set(...c.pos); cone.lookAt(...c.look); cone.renderOrder = 7; coneGroup.add(cone); c.cone = cone;
  });
  // housings, arms and recording lights as one instanced mesh each
  const rigBody = new T.InstancedMesh(camBody, camMat, CAMS.length), rigArm = new T.InstancedMesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 6), W.mat('#59626b'), CAMS.length), rigLed = new T.InstancedMesh(new T.SphereGeometry(0.035, 6, 6), ledMat, CAMS.length);
  const ob = new T.Object3D();
  CAMS.forEach((c, i) => {
    ob.position.set(...c.pos); ob.lookAt(...c.look); ob.updateMatrix(); rigBody.setMatrixAt(i, ob.matrix);
    ob.position.y += 0.06; ob.translateZ(0.3); ob.updateMatrix(); rigLed.setMatrixAt(i, ob.matrix);
    ob.rotation.set(0, 0, 0); ob.position.set(c.pos[0], c.pos[1] + 0.3, c.pos[2]); ob.updateMatrix(); rigArm.setMatrixAt(i, ob.matrix);
  });
  [rigBody, rigArm, rigLed].forEach((m) => { m.frustumCulled = false; rigGroup.add(m); });
  const P3 = new T.Vector3();
  // the first camera that really has this point in its picture
  function seenBy(x, y, z) {
    let best = null, bd = 1e9;
    CAMS.forEach((c) => {
      P3.set(x, y, z).project(c.cam);
      if (P3.z < 1 && Math.abs(P3.x) < 1 && Math.abs(P3.y) < 1) { const d = Math.hypot(c.pos[0] - x, c.pos[2] - z); if (d < bd && d < 70) { bd = d; best = c; } }
    });
    return best;
  }
  function coverage() {
    let hit = 0, n = 0;
    for (let x = -66; x <= 66; x += 4) for (let z = -38; z <= 38; z += 4) { n++; if (seenBy(x, 1, z)) hit++; }
    return hit / n;
  }

  // ---------- records ----------
  const events = [];
  const open = []; // tickets the supervisor still has to close
  const applied = {}; // fixes: type -> rate factor
  const counters = { byType: {}, afterFix: {} };
  let seq = 0;
  const shiftName = (t) => { const h = ((t / 3600) % 24 + 24) % 24; return h >= 7 && h < 15 ? 'Day shift' : h >= 15 && h < 23 ? 'Evening shift' : 'Night shift'; };
  const zoneName = (x, z) => { const zn = B.ZONES.find((q) => x >= q.x[0] && x <= q.x[1] && z >= q.z[0] && z <= q.z[1]); return zn ? zn.name : WALKS.some((r) => inRect(r, x, z)) ? 'Walkways' : 'Main lanes'; };
  const nameOf = (a) => (a.anon ? 'Worker ' + a.id.toUpperCase() : a.name);

  const cool = new Map();
  function record(type, who, whoId, x, z, extra) {
    const key = type + '|' + whoId;
    if (S.st.t - (cool.get(key) || -1e9) < 240) return null;
    if (HABIT[whoId] < 0.2 && R() > 0.15) { cool.set(key, S.st.t); return null; } // staff off the walkways on their duties are rarely flagged
    const c = seenBy(x, 1, z);
    if (!c) { W2.blind++; return null; } // nothing is detected where no camera looks
    cool.set(key, S.st.t);
    const e = Object.assign({ id: ++seq, t: S.st.t, type, who, whoId, points: TYPES[type].points, cam: c.id, x, z, zone: zoneName(x, z), shift: shiftName(S.st.t), closed: false }, extra || {});
    events.push(e); if (events.length > 800) events.shift();
    counters.byType[type] = (counters.byType[type] || 0) + 1;
    if (e.points >= 4) open.push(e);
    if (open.length > 12) open.shift();
    if (B.timeline) B.timeline.events.push({ t: e.t, m: who + ': ' + TYPES[type].name, kind: e.points >= 5 ? 'near' : 'other' });
    W2.onEvent.forEach((f) => f(e));
    return e;
  }
  const W2 = { blind: 0, onEvent: [] };

  // ---------- what the people do: real detours and missing kit that the checks then pick up ----------
  const walkers = () => A.list.filter((a) => a.kind === 'person' && a.route);
  function dress() {
    A.list.filter((a) => a.kind === 'person' && !a.wtch).forEach((a) => {
      const u = a.mesh.userData;
      a.wtch = { hat: u.kitHat || [], vest: u.kitVest || [] };
      const ph = new T.Mesh(new T.BoxGeometry(0.05, 0.1, 0.012), new T.MeshStandardMaterial({ color: '#0d1014', roughness: 0.2, metalness: 0.7 }));
      ph.position.set(0, -0.32 * u.s, 0.05); ph.visible = false; u.elbowR.add(ph); a.wtch.phone = ph;
    });
  }
  function setKit(a, kind, on) {
    if (!a.wtch) return;
    a.wtch[kind].forEach((m) => (m.visible = on));
  }
  // a one-off point in the walker's route, removed again when it has been reached
  function detour(a, pts) {
    const list = pts.map((p) => Object.assign({ temp: true }, p));
    a.route.splice(a.i, 0, ...list);
  }
  function tidyRoute(a) {
    for (let k = a.route.length - 1; k >= 0; k--) {
      const p = a.route[k];
      if (!p.temp) continue;
      if (k < a.i || (k !== a.i && Math.hypot(a.x - p.x, a.z - p.z) < 0.05)) { a.route.splice(k, 1); if (k < a.i) a.i--; }
    }
    if (a.i >= a.route.length) a.i = 0;
  }
  const active = new Map(); // person -> {kind, until}
  function stage_(a, kind, secs) {
    active.set(a, { kind, until: S.st.t + secs });
    if (kind === 'helmet') setKit(a, 'hat', false);
    if (kind === 'vest') setKit(a, 'vest', false);
    if (kind === 'phone') { a.wtch.phone.visible = true; }
  }
  function endStage(a) {
    const st = active.get(a); if (!st) return;
    if (st.kind === 'helmet') setKit(a, 'hat', true);
    if (st.kind === 'vest') setKit(a, 'vest', true);
    if (st.kind === 'phone') a.wtch.phone.visible = false;
    active.delete(a);
  }
  const factor = (t) => (applied[t] ? applied[t] : 1);
  function misbehave(dt) {
    // dt is in simulated seconds; about 1.6 rule events per person per simulated hour at habit 1
    walkers().forEach((a) => {
      if (active.has(a) || a.onBreakWalk) return;
      const rate = ((HABIT[a.id] || 0.6) * 5.5) / 3600;
      if (R() > rate * dt) return;
      const roll = R();
      if (roll < 0.28 && a.wait <= 0) { // shortcut across the forklift lane
        if (R() > factor('lane')) return;
        const p = a.route[a.i]; if (!p) return;
        const off = Math.abs(a.x - 44.6) < 3 ? { x: a.x - 5.5, z: a.z + (p.z > a.z ? 7 : -7) } : { x: a.x + (p.x > a.x ? 7 : -7), z: a.z + 5.5 };
        if (off.x > -60 && off.z < 36 && off.z > -36) detour(a, [off]);
      } else if (roll < 0.5) { if (R() < factor('helmet')) stage_(a, 'helmet', 150 + R() * 200); }
      else if (roll < 0.66) { if (R() < factor('vest')) stage_(a, 'vest', 150 + R() * 200); }
      else if (roll < 0.86) { if (R() < factor('phone')) stage_(a, 'phone', 60 + R() * 80); }
      else if (roll < 0.94) { // into the hazmat cage through the gate, without a permit
        if (R() < factor('hazmat') && a.x > 40) detour(a, [{ x: 46, z: 8 }, { x: 50.5, z: 9 }, { x: 46, z: 8 }]);
      } else { // next to a forklift whose forks are up
        const f = S.forklifts.find((q) => q.lift && q.carY > 1.2 && Math.hypot(q.x - a.x, q.z - a.z) < 26);
        if (f && R() < factor('forks')) { f.lift.timer = Math.min(f.lift.timer, -22); detour(a, [{ x: f.x + 1.2, z: f.z + 0.6 }]); }
      }
    });
    // a pallet parked in front of a fire exit, or a driver rushing
    if (R() < (0.5 / 3600) * dt * factor('exit')) blockExit();
    S.forklifts.forEach((f) => { if (f.burst || f.down) return; if (R() < (0.9 / 3600) * dt * (f.rush || 1) * factor('speed')) { f.burst = 1.6; f.burstUntil = S.st.t + 50 + R() * 40; } });
  }
  function endBursts() { S.forklifts.forEach((f) => { if (f.burst && S.st.t > f.burstUntil) { f.burst = 0; } }); }

  // fire exit blocked: a real pallet in the way until someone clears it
  const EXIT_SPOTS = [{ id: 'N1', x: -26, z: -38 }, { id: 'N2', x: 22, z: -38 }, { id: 'S1', x: -32, z: 38 }, { id: 'S2', x: 44, z: 38 }, { id: 'W1', x: -67, z: -15 }, { id: 'W2', x: -67, z: 22 }, { id: 'E1', x: 67, z: 0 }];
  const blocked = [];
  function blockExit(which) {
    const free = EXIT_SPOTS.filter((e) => !blocked.some((b) => b.exit === e));
    const pick = which || free[Math.floor(R() * free.length)]; if (!pick) return null;
    const it = Math.floor(R() * B.ITEMS.length), m = W.makePallet(it); m.position.set(pick.x, 0, pick.z); scene.add(m);
    const f = S.forklifts[Math.floor(R() * S.forklifts.length)];
    const e = record('exit', 'Forklift ' + f.n + ' driver', 'fl' + f.n, pick.x, pick.z, { exit: pick.id });
    const b = { exit: pick, mesh: m, until: S.st.t + 900, ev: e };
    blocked.push(b);
    return b;
  }
  function clearExit(b) { scene.remove(b.mesh); blocked.splice(blocked.indexOf(b), 1); if (b.ev) closeTicket(b.ev); }

  // ---------- live checks against the positions ----------
  const lastPos = new Map();
  function checks(dt) {
    A.list.forEach((a) => {
      if (a.kind !== 'person') return;
      if (a.update && a.state === 'desk') return;
      const st = active.get(a), nm = nameOf(a);
      if (st && st.kind !== 'phone') record(st.kind, nm, a.id, a.x, a.z);
      if (st && st.kind === 'phone' && a.wait <= 0) record('phone', nm, a.id, a.x, a.z);
      if (!onPath(a.x, a.z) && !inCage(a.x, a.z) && !a.chatting) {
        if (a.route) record('lane', nm, a.id, a.x, a.z);
        else if (a.id === 'abdullah' || a.id === 'ghazi') { a.offT = (a.offT || 0) + dt; if (a.offT > 25) { a.offT = 0; record('lane', nm, a.id, a.x, a.z); } } else a.offT = 0;
      }
      if (inCage(a.x, a.z)) record('hazmat', nm, a.id, a.x, a.z);
    });
    S.forklifts.forEach((f) => {
      const p = lastPos.get(f);
      if (p && dt > 0) {
        const v = Math.hypot(f.x - p.x, f.z - p.z) / dt;
        f.speedNow = v;
        if (v > SPEED_LIMIT && f.path && f.path.length && !f.down) record('speed', 'Forklift ' + f.n + ' driver', 'fl' + f.n, f.x, f.z, { speed: v });
      }
      lastPos.set(f, { x: f.x, z: f.z });
      A.list.forEach((a) => {
        if (a.kind !== 'person') return;
        const d = Math.hypot(a.x - f.x, a.z - f.z);
        if (d < 3 && f.carY > 1.2) record('forks', nameOf(a), a.id, a.x, a.z, { forklift: f.n });
      });
    });
    blocked.slice().forEach((b) => { if (S.st.t > b.until) clearExit(b); });
    active.forEach((st, a) => { if (S.st.t > st.until) endStage(a); });
  }

  // near misses from the safety module become close-call events and tickets
  const addLog = S.addLog;
  S.addLog = (m, k) => {
    const q = /^Near miss: forklift (\d+) and (.+) in /.exec(m);
    if (q) {
      const a = A.list.find((p) => p.kind === 'person' && (p.name === q[2] || (p.anon && q[2] === 'a worker' && Math.hypot(p.x - S.forklifts[+q[1] - 1].x, p.z - S.forklifts[+q[1] - 1].z) < 2)));
      const f = S.forklifts[+q[1] - 1];
      if (a && f) record('close', nameOf(a), a.id, a.x, a.z, { forklift: f.n });
    }
    addLog(m, k);
  };

  // ---------- instant warning: beacon, ring and beep when a person gets within 5 m of a moving forklift ----------
  const beaconTex = B.loads.canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,80,50,0.7)'); gr.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const warnRing = new T.RingGeometry(3.6, 4.6, 48);
  function dressForklift(f) {
    const u = f.mesh.userData; if (u.wBeacon) return;
    const s = new T.Sprite(new T.SpriteMaterial({ map: beaconTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.scale.setScalar(1.3); s.position.set(0, 2.75, 0.3); s.visible = false; f.mesh.add(s); u.wBeacon = s;
    const r = new T.Mesh(warnRing, new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide, toneMapped: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.07; r.visible = false; r.renderOrder = 6; f.mesh.add(r); u.warnRing = r;
  }
  let warnOn = true, tBeep = 0;
  function warnings(dt, now) {
    let any = false;
    S.forklifts.forEach((f) => {
      dressForklift(f);
      const u = f.mesh.userData;
      const moving = f.path && f.path.length && !f.lift && !f.down;
      const near = !!(warnOn && moving) && A.list.some((a) => a.kind === 'person' && Math.hypot(a.x - f.x, a.z - f.z) < 5 && a.state !== 'desk' && !(a.state === 'brew'));
      f.warn = near;
      u.wBeacon.visible = near && Math.sin(now * 14) > -0.2;
      u.warnRing.visible = near; if (near) { u.warnRing.material.opacity = 0.35 + 0.3 * Math.sin(now * 9); any = true; }
    });
    if (any && (tBeep += dt) > 0.7) { tBeep = 0; if (B.sound) B.sound.beep(); }
  }

  // ---------- frame ----------
  let tCheck = 0, tSlow = 0, lastT = S.st.t;
  B.hooks.frame.push((dt) => {
    const now = performance.now() / 1000;
    walkers().forEach(tidyRoute);
    warnings(dt, now);
    rigLed.visible = Math.sin(now * 3) > 0;
    if (!S.st.running || (B.evac && B.evac.active()) || (B.timeline && B.timeline.active())) { lastT = S.st.t; return; }
    const sdt = S.st.t - lastT;
    if ((tCheck += dt) < 0.15 || sdt <= 0) return;
    lastT = S.st.t; tCheck = 0;
    dress(); endBursts(); misbehave(sdt); checks(sdt);
    tSlow += sdt;
  });
  // phone: arm stays up after the walker animation has run
  const update = A.update;
  A.update = function (dt) {
    update(dt);
    active.forEach((st, a) => { if (st.kind === 'phone' && a.mesh.userData.armR) { const u = a.mesh.userData; u.armR.rotation.x = -1.75; u.elbowR.rotation.x = -1.65; } });
  };

  function closeTicket(e) { e.closed = true; const k = open.indexOf(e); if (k >= 0) open.splice(k, 1); }

  // ---------- tickets in the alert bell ----------
  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => open.slice(-3).reverse().map((e) => ({ key: 'watch' + e.id, level: e.points >= 6 ? 'bad' : 'warn', text: 'Safety ticket: ' + e.who + ', ' + TYPES[e.type].name.toLowerCase(), sub: e.zone + ', ' + S.clock(e.t) + ', seen on ' + e.cam + '. Simulated detection.', act: 'Evidence', go: () => B.watch.evidence(e) })));

  // ---------- summaries ----------
  function board(by, since) {
    const key = { person: 'who', shift: 'shift', zone: 'zone', type: 'type' }[by];
    const map = {};
    const cut = S.st.t - 1800;
    events.filter((e) => !since || e.t >= since).forEach((e) => {
      const k = e[key], q = map[k] || (map[k] = { key: k, label: by === 'type' ? TYPES[k].name : k, n: 0, pts: 0, recent: 0, prev: 0 });
      q.n++; q.pts += e.points;
      if (e.t >= cut) q.recent++; else if (e.t >= cut - 1800) q.prev++;
    });
    return Object.values(map).sort((a, b) => b.pts - a.pts);
  }

  B.watch = Object.assign(W2, { TYPES, CAMS, WALKS, events, open, applied, counters, blocked, active, extraWalks, coneGroup, rigGroup, walkGroup, seenBy, coverage, board, record, closeTicket, blockExit, clearExit, stage: stage_, endStage, detour, setKit, onPath, paintWalk, shiftName, zoneName, nameOf, dress, setWarn: (v) => (warnOn = v), warnOn: () => warnOn, SPEED_LIMIT });
})();
