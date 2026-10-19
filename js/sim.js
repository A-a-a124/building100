/* Building 100 - discrete-event simulation of receiving, put-away and issue */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = B.world;
  const L = B.LANES;
  const R = B.rng(2026);
  const S = (B.sim = {});

  // Hourly arrival rates per scenario
  S.RATES = {
    low: { name: 'Low', trucks: 1.5, orders: 2 },
    base: { name: 'Normal', trucks: 3, orders: 4 },
    high: { name: 'High', trucks: 5.5, orders: 7 },
  };
  S.st = { t: 7 * 3600, rate: 'base', speed: 5, running: true, received: 0, shipped: 0, trucksIn: 0, ordersDone: 0, cycleSum: 0, busy: 0, total: 0 };
  S.forklifts = [];
  S.tasks = [];
  S.trucks = [];
  S.orders = [];
  S.pendingOrders = [];
  S.history = [];
  S.log = [];
  S.occ = B.occupiedCount();
  let orderSeq = 4100;
  let nextSample = 0;

  S.clock = (t) => {
    const m = Math.floor(t / 60) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  S.addLog = (m, k) => log(m, k);
  function log(msg, kind) {
    S.log.unshift({ t: S.clock(S.st.t), msg, kind: kind || 'info' });
    if (S.log.length > 30) S.log.pop();
    if (S.onLog) S.onLog();
  }

  // ---------- Forklifts ----------
  function makeForklift(n) {
    const g = new T.Group();
    const body = W.box(1.15, 0.9, 1.9, '#f2b31b', { roughness: 0.5 });
    body.position.set(0, 0.7, 0.25);
    const cw = W.box(1.15, 0.7, 0.45, '#2f3439');
    cw.position.set(0, 0.85, 1.15);
    const seat = W.box(0.6, 0.35, 0.5, '#2f3439');
    seat.position.set(0, 1.3, 0.55);
    g.add(body, cw, seat);
    [[-0.5, -0.45], [0.5, -0.45], [-0.5, 1.05], [0.5, 1.05]].forEach(([x, z]) => {
      const p = W.box(0.06, 1.2, 0.06, '#2f3439');
      p.position.set(x * 0.95, 1.75, z);
      g.add(p);
    });
    const roof = W.box(1.1, 0.06, 1.6, '#2f3439');
    roof.position.set(0, 2.35, 0.3);
    g.add(roof);
    const wheelGeo = new T.CylinderGeometry(0.3, 0.3, 0.25, 14);
    [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.95], [0.55, 0.95]].forEach(([x, z]) => {
      const w = new T.Mesh(wheelGeo, W.mat('#1c1f22'));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.3, z);
      g.add(w);
    });
    const mast = W.box(0.9, 2.3, 0.1, '#3d434a', { metalness: 0.4 });
    mast.position.set(0, 1.25, -0.75);
    const inner = W.box(0.7, 1, 0.08, '#555d66', { metalness: 0.4 });
    inner.position.set(0, 1.25, -0.82);
    const car = new T.Group();
    const plate = W.box(0.95, 0.5, 0.06, '#2f3439');
    plate.position.set(0, 0.25, 0);
    const f1 = W.box(0.12, 0.05, 1.1, '#2f3439');
    f1.position.set(-0.28, 0.03, -0.55);
    const f2 = f1.clone();
    f2.position.x = 0.28;
    car.add(plate, f1, f2);
    car.position.set(0, 0.12, -0.88);
    g.add(mast, inner, car);
    const num = W.makeLabel(String(n), { size: 0.7, bg: '#1a1300', fg: '#f2b31b', weight: 700, depthTest: true });
    num.position.set(0, 2.9, 0.3);
    g.add(num);
    g.userData = { car, inner };
    return g;
  }

  function addForklift() {
    const n = S.forklifts.length + 1;
    const chg = B.zoneById('CHG');
    const home = { x: chg.x[0] + 1 + ((n - 1) % 6) * 2.2, z: chg.z[0] + 2.8, lz: L.front, face: { x: chg.x[0] + 1 + ((n - 1) % 6) * 2.2, z: chg.z[0] } };
    const mesh = makeForklift(n);
    mesh.position.set(home.x, 0, home.z);
    const f = { n, mesh, x: home.x, z: home.z, head: 0, path: [], task: null, phase: 'idle', carY: 0.12, load: null, home, busyT: 0, totT: 0, lift: null, at: null };
    mesh.traverse((o) => (o.userData.pick = { type: 'forklift', n }));
    W.pickables.push(mesh);
    W.scene.add(mesh);
    S.forklifts.push(f);
    if (n > 1 || S.started) f.at = home;
    return f;
  }
  S.targetForklifts = 5;
  S.setForklifts = function (n) {
    S.targetForklifts = Math.max(1, Math.min(10, n));
    while (S.forklifts.length < S.targetForklifts) addForklift();
  };
  function trimForklifts() {
    while (S.forklifts.length > S.targetForklifts) {
      const f = S.forklifts[S.forklifts.length - 1];
      if (f.phase !== 'idle' && f.phase !== 'home') return;
      W.scene.remove(f.mesh);
      W.pickables.splice(W.pickables.indexOf(f.mesh), 1);
      S.forklifts.pop();
    }
  }

  // ---------- Routing on the lane network ----------
  function route(from, to) {
    const pts = [{ x: from.x, z: from.lz }];
    if (Math.abs(from.lz - to.lz) > 0.01) {
      const cw = Math.abs(from.x - L.west) + Math.abs(to.x - L.west);
      const ce = Math.abs(from.x - L.east) + Math.abs(to.x - L.east);
      // Points west of the racks can only reach the network via the west lane
      const cx = cw <= ce || from.x < L.west || to.x < L.west ? L.west : L.east;
      pts.push({ x: cx, z: from.lz }, { x: cx, z: to.lz });
    }
    pts.push({ x: to.x, z: to.lz }, { x: to.x, z: to.z });
    return pts;
  }
  const slotPoint = (s) => ({ x: s.x, z: s.access, lz: s.access, face: { x: s.x, z: s.z }, y: s.y + 0.15 });
  const inPoint = (p) => ({ x: p.x, z: p.z + 2.2, lz: L.front, face: { x: p.x, z: p.z }, y: 0.12 });
  const outPoint = (p) => ({ x: p.x, z: p.z - 2.2, lz: L.back, face: { x: p.x, z: p.z }, y: 0.12 });

  function go(f, target, phase) {
    const from = f.at || { x: f.x, z: f.z, lz: f.z };
    f.path = route(from, target);
    f.dest = target;
    f.phase = phase;
  }

  // ---------- Tasks ----------
  function findEmptySlot(itemIdx) {
    const cat = B.ITEMS[itemIdx].cat;
    const rows = B.ROW_CAT.map((c, i) => (c === cat ? i : -1)).filter((i) => i >= 0);
    let cand = B.SLOTS.filter((s) => s.item < 0 && !s.reserved && rows.includes(s.row));
    if (!cand.length) cand = B.SLOTS.filter((s) => s.item < 0 && !s.reserved);
    if (!cand.length) return null;
    cand.sort((a, b) => a.level - b.level || a.bay - b.bay);
    return cand[Math.floor(Math.pow(R(), 2) * Math.min(cand.length, 40))];
  }

  function assign() {
    for (const f of S.forklifts) {
      if (f.phase !== 'idle') continue;
      const task = S.tasks.find((t) => !t.fl);
      if (!task) {
        if (f.phase === 'idle' && f.at !== f.home) go(f, f.home, 'home');
        continue;
      }
      task.fl = f;
      f.task = task; f.taskDist = 0;
      go(f, task.type === 'put' ? inPoint(task.from) : slotPoint(task.from), 'toPick');
    }
  }

  function spawnTruck(dir, door) {
    door = door || W.doorsIn.find((d) => !d.busy);
    if (!door || (dir === 'out' && door.busy)) return null;
    W.setDoorLamp(door, true);
    const g = new T.Group();
    const trailer = W.box(2.5, 2.9, 12, '#d9dde1');
    trailer.position.set(0, 2.25, -6);
    const stripe = W.box(2.52, 0.3, 12, dir === 'in' ? '#2b5c9c' : '#d08a12');
    stripe.position.set(0, 1.6, -6);
    const cab = W.box(2.5, 2.6, 2.4, '#f4f6f8');
    cab.position.set(0, 1.9, -13.6);
    const glass = W.box(2.3, 0.9, 0.05, '#27313b', { metalness: 0.6, roughness: 0.2 });
    glass.position.set(0, 2.6, -14.82);
    g.add(trailer, stripe, cab, glass);
    const wg = new T.CylinderGeometry(0.5, 0.5, 0.4, 14);
    [-1.6, -3, -12.8].forEach((z) => [-1.1, 1.1].forEach((x) => {
      const w = new T.Mesh(wg, W.mat('#1c1f22'));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.5, z);
      g.add(w);
    }));
    const outZ = door.z - door.dir * 60;
    g.rotation.y = dir === 'in' ? 0 : Math.PI;
    g.position.set(door.x, 0, outZ);
    W.scene.add(g);
    const tr = { dir, door, mesh: g, z: outZ, dockZ: door.z - door.dir * 0.4, phase: 'arrive', timer: 0 };
    S.trucks.push(tr);
    return tr;
  }

  function newInbound() {
    const tr = spawnTruck('in');
    if (!tr) return;
    tr.count = 6 + Math.floor(R() * 7);
    tr.done = 0;
    S.st.trucksIn++;
    log('Inbound truck at door IN ' + tr.door.n + ' with ' + tr.count + ' pallets', 'in');
  }

  function newOrder() {
    const lines = 2 + Math.floor(R() * 5);
    const order = { id: 'SO-' + orderSeq++, lines, picked: 0, created: S.st.t, door: null, pos: [] };
    S.pendingOrders.push(order);
    log('New issue order ' + order.id + ' (' + lines + ' pallets)', 'out');
  }

  function releaseOrders() {
    while (S.pendingOrders.length) {
      const door = W.doorsOut.find((d) => !d.busy && !S.orders.some((o) => o.door === d));
      if (!door) return;
      const cand = B.SLOTS.filter((s) => s.item >= 0 && !s.reserved);
      if (cand.length < S.pendingOrders[0].lines) return;
      const o = S.pendingOrders.shift();
      o.door = door;
      o.pos = W.stageOut.filter((p) => p.door === door).slice(0, o.lines);
      o.pos.forEach((p) => {
        const free = cand.filter((s) => !s.reserved);
        const s = free[Math.floor(R() * free.length)];
        s.reserved = true;
        S.tasks.push({ type: 'pick', from: s, to: p, order: o, created: S.st.t });
      });
      S.orders.push(o);
    }
  }

  // ---------- Update ----------
  function moveAlong(f, dt) {
    // safety module may hold a forklift back to yield to another truck or a person
    if (B.safety && B.safety.blocked(f, dt)) return false;
    const sp = f.load ? 2.4 : 3.2;
    let left = sp * dt;
    while (left > 0 && f.path.length) {
      const p = f.path[0];
      const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz);
      if (d < 1e-3) { f.path.shift(); continue; }
      f.head = Math.atan2(-dx, -dz);
      const step = Math.min(d, left);
      f.x += (dx / d) * step;
      f.z += (dz / d) * step;
      f.dist = (f.dist || 0) + step; f.taskDist = (f.taskDist || 0) + step;
      left -= step;
    }
    return f.path.length === 0;
  }

  function faceTarget(f) {
    const fc = f.dest.face;
    f.head = Math.atan2(-(fc.x - f.x), -(fc.z - f.z));
  }

  function startLift(f, y, onTop) {
    f.lift = { y, step: 0, timer: 0, onTop };
    faceTarget(f);
  }
  function updateLift(f, dt) {
    const lf = f.lift;
    const v = 0.9 * dt;
    if (lf.step === 0) {
      f.carY = Math.min(lf.y, f.carY + v);
      if (f.carY >= lf.y - 1e-3) lf.step = 1;
    } else if (lf.step === 1) {
      lf.timer += dt;
      if (lf.timer > 1.5) { lf.onTop(); lf.step = 2; }
    } else {
      f.carY = Math.max(0.12, f.carY - v);
      if (f.carY <= 0.121) { f.lift = null; return true; }
    }
    return false;
  }

  function attach(f, itemIdx) {
    const p = W.makePallet(itemIdx);
    p.position.set(0, 0.06, -0.62);
    f.mesh.userData.car.add(p);
    f.load = p;
  }
  function detach(f) {
    if (f.load) f.mesh.userData.car.remove(f.load);
    f.load = null;
  }

  function updateForklift(f, dt) {
    f.totT += dt;
    if (f.phase !== 'idle') f.busyT += dt;
    const t = f.task;
    if (f.phase === 'home') {
      if (moveAlong(f, dt)) { f.at = f.home; f.phase = 'idle'; f.head = Math.PI * 0 + Math.atan2(0, 1); }
    } else if (f.phase === 'toPick') {
      if (moveAlong(f, dt)) {
        f.at = f.dest;
        f.phase = 'pick';
        startLift(f, f.dest.y, () => {
          if (t.type === 'put') {
            t.from.used.parent && t.from.used.parent.remove(t.from.used);
            t.from.used = null;
            attach(f, t.item);
          } else {
            attach(f, t.from.item);
            t.item = t.from.item;
            t.qty = t.from.qty;
            t.from.item = -1;
            t.from.reserved = false;
            S.occ--;
            W.updateSlot(t.from);
          }
        });
      }
    } else if (f.phase === 'pick') {
      if (updateLift(f, dt)) go(f, t.type === 'put' ? slotPoint(t.to) : outPoint(t.to), 'toDrop');
    } else if (f.phase === 'toDrop') {
      if (moveAlong(f, dt)) {
        f.at = f.dest;
        f.phase = 'drop';
        startLift(f, f.dest.y, () => {
          detach(f);
          if (t.type === 'put') {
            const s = t.to;
            s.item = t.item;
            s.qty = t.qty;
            s.days = 0;
            s.reserved = false;
            S.occ++;
            S.st.received++;
            W.updateSlot(s);
          } else {
            const p = W.makePallet(t.item);
            p.position.set(t.to.x, 0, t.to.z);
            W.scene.add(p);
            t.to.used = p;
            t.order.picked++;
            if (t.order.picked === t.order.lines) {
              const tr = spawnTruck('out', t.order.door);
              if (tr) { tr.order = t.order; tr.done = 0; log('Order ' + t.order.id + ' ready to load at door OUT ' + t.order.door.n, 'out'); }
              else t.order.waitTruck = true;
            }
          }
        });
      }
    } else if (f.phase === 'drop') {
      if (updateLift(f, dt)) {
        S.tasks.splice(S.tasks.indexOf(t), 1);
        f.task = null;
        f.phase = 'idle';
      }
    }
    f.mesh.position.set(f.x, 0, f.z);
    let dh = f.head - f.mesh.rotation.y;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    f.mesh.rotation.y += dh * Math.min(1, dt * 8);
    f.mesh.userData.car.position.y = f.carY;
    const inner = f.mesh.userData.inner;
    const ih = Math.max(1, f.carY + 0.9);
    inner.scale.y = ih;
    inner.position.y = ih / 2 + Math.max(0, f.carY - 1.2) * 0.5;
  }

  function updateTruck(tr, dt) {
    const sp = 6;
    if (tr.phase === 'arrive') {
      const d = tr.dockZ - tr.z;
      tr.z += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      if (Math.abs(d) < 0.01) { tr.phase = 'work'; tr.timer = 0; }
    } else if (tr.phase === 'work') {
      tr.timer += dt;
      if (tr.timer > 20) {
        tr.timer = 0;
        if (tr.dir === 'in') {
          if (tr.done < tr.count) {
            const p = W.stageIn.find((q) => q.door === tr.door && !q.used) || W.stageIn.find((q) => !q.used);
            if (p) {
              const ri = Math.floor(R() * 12);
              const item = B.randomItemForRow(ri, R);
              const it = B.ITEMS[item];
              const slot = findEmptySlot(item);
              if (slot) {
                slot.reserved = true;
                const m = W.makePallet(item);
                m.position.set(p.x, 0, p.z);
                W.scene.add(m);
                p.used = m;
                S.tasks.push({ type: 'put', from: p, to: slot, item, qty: Math.max(1, Math.round(it.per * (0.5 + 0.5 * R()))), created: S.st.t });
              }
              tr.done++;
            }
          } else tr.phase = 'leave';
        } else {
          const p = tr.order.pos[tr.done];
          if (p) {
            if (p.used) W.scene.remove(p.used);
            p.used = null;
            tr.done++;
            S.st.shipped++;
          }
          if (tr.done >= tr.order.lines) {
            tr.phase = 'leave';
            const o = tr.order;
            S.st.ordersDone++;
            S.st.cycleSum += S.st.t - o.created;
            S.orders.splice(S.orders.indexOf(o), 1);
            log('Order ' + o.id + ' shipped, cycle time ' + Math.round((S.st.t - o.created) / 60) + ' min', 'done');
          }
        }
      }
    } else if (tr.phase === 'leave') {
      const target = tr.door.z - tr.door.dir * 70;
      const d = target - tr.z;
      tr.z += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      if (Math.abs(d) < 0.01) {
        W.scene.remove(tr.mesh);
        S.trucks.splice(S.trucks.indexOf(tr), 1);
        if (tr.dir === 'in') W.setDoorLamp(tr.door, false);
        else W.setDoorLamp(tr.door, false);
        return;
      }
    }
    tr.mesh.position.z = tr.z;
  }

  function step(dt) {
    const st = S.st;
    st.t += dt;
    const rate = S.RATES[st.rate];
    const shiftK = B.env ? B.env.rateFactor() : 1;
    if (R() < (rate.trucks * shiftK / 3600) * dt) newInbound();
    if (R() < (rate.orders * shiftK / 3600) * dt) newOrder();
    releaseOrders();
    S.orders.forEach((o) => {
      if (o.waitTruck) { const tr = spawnTruck('out', o.door); if (tr) { tr.order = o; tr.done = 0; o.waitTruck = false; } }
    });
    assign();
    S.forklifts.slice().forEach((f) => updateForklift(f, dt));
    S.trucks.slice().forEach((tr) => updateTruck(tr, dt));
    trimForklifts();
    if (st.t >= nextSample) {
      nextSample = st.t + 300;
      S.history.push({ t: st.t, occ: S.occ / B.SLOTS.length, open: S.tasks.length });
      if (S.history.length > 144) S.history.shift();
    }
  }

  S.update = function (realDt) {
    if (!S.st.running) return;
    let dt = Math.min(realDt, 0.1) * S.st.speed;
    while (dt > 0) {
      const d = Math.min(dt, 0.25);
      step(d);
      dt -= d;
    }
  };

  S.kpis = function () {
    let busy = 0, tot = 0;
    S.forklifts.forEach((f) => { busy += f.busyT; tot += f.totT; });
    return {
      clock: S.clock(S.st.t),
      occ: S.occ / B.SLOTS.length,
      received: S.st.received,
      shipped: S.st.shipped,
      open: S.tasks.length + S.pendingOrders.reduce((n, o) => n + o.lines, 0),
      util: tot ? busy / tot : 0,
      cycle: S.st.ordersDone ? S.st.cycleSum / S.st.ordersDone / 60 : null,
      trucks: S.trucks.length,
    };
  };

  S.describeForklift = function (n) {
    const f = S.forklifts.find((q) => q.n === n);
    if (!f) return null;
    const t = f.task;
    const map = { idle: 'Parked at charger', home: 'Returning to charger', toPick: 'Driving to pick up', pick: 'Picking up pallet', toDrop: 'Carrying pallet', drop: 'Setting down pallet' };
    let detail = '';
    if (t) {
      const it = B.ITEMS[t.type === 'put' ? t.item : t.item != null ? t.item : t.from.item];
      detail = t.type === 'put'
        ? 'Put-away: from Receiving (door IN ' + t.from.door.n + ') to ' + t.to.code
        : 'Issue: from ' + t.from.code + ' to door OUT ' + t.to.door.n + ' (' + t.order.id + ')';
      if (it) detail += ', ' + it.name;
    }
    return { n, status: map[f.phase] || f.phase, detail, util: f.totT ? f.busyT / f.totT : 0, f };
  };

  S.resetStats = function () {
    Object.assign(S.st, { received: 0, shipped: 0, trucksIn: 0, ordersDone: 0, cycleSum: 0 });
    S.forklifts.forEach((f) => { f.busyT = 0; f.totT = 0; });
  };

  S.init = function () {
    for (let k = 0; k < S.targetForklifts; k++) addForklift();
    S.forklifts.forEach((f) => (f.at = f.home));
    S.started = true;
    newInbound();
    newInbound();
    newOrder();
    newOrder();
  };
})();
