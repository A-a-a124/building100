/* Building 100 - drones: indoor cycle-count drone and yard survey drone */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = B.world;
  const RACK = B.RACK;
  function turn(mesh, target, dt) {
    let d = target - mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    mesh.rotation.y += d * Math.min(1, dt * 6);
  }
  // ---------- drone ----------
  function makeDrone(color) {
    const g = new T.Group();
    const core = W.box(0.36, 0.12, 0.36, '#23282e', { metalness: 0.5, roughness: 0.4 });
    g.add(core);
    const shell = W.box(0.22, 0.06, 0.28, color, { metalness: 0.3 });
    shell.position.y = 0.09;
    g.add(shell);
    const rotors = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const arm = W.box(0.5, 0.03, 0.04, '#23282e');
      arm.position.set(sx * 0.2, 0.02, sz * 0.2);
      arm.rotation.y = sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4;
      g.add(arm);
      const motor = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.07, 10), W.mat('#3b4148'));
      motor.position.set(sx * 0.36, 0.05, sz * 0.36);
      g.add(motor);
      const disc = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.01, 24), new T.MeshBasicMaterial({ color: '#d7e3ee', transparent: true, opacity: 0.28, depthWrite: false }));
      disc.position.set(sx * 0.36, 0.1, sz * 0.36);
      const blade = W.box(0.36, 0.008, 0.03, '#11161b');
      blade.position.copy(disc.position);
      g.add(disc, blade);
      rotors.push(blade);
    });
    const led = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), new T.MeshBasicMaterial({ color: '#4dff88' }));
    led.position.set(0, -0.02, 0.19);
    g.add(led);
    const cone = new T.Mesh(new T.ConeGeometry(0.9, 2.2, 24, 1, true), new T.MeshBasicMaterial({ color: '#58d0ff', transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }));
    g.add(cone);
    g.userData = { rotors, cone, led };
    return g;
  }


  // Drones fly over the racks, drop into an aisle and sweep one level at a time
  function updateDrone(d, dt) {
    const u = d.mesh.userData;
    u.rotors.forEach((r, k) => (r.rotation.y += dt * (d.y > d.padY + 0.05 ? 60 : 4) * (k % 2 ? 1 : -1)));
    d.t += dt;
    const fly = (tx, ty, tz, sp) => {
      const dx = tx - d.x, dy = ty - d.y, dz = tz - d.z, dist = Math.hypot(dx, dy, dz), s = sp * dt;
      if (dist <= s) { d.x = tx; d.y = ty; d.z = tz; return true; }
      d.x += (dx / dist) * s; d.y += (dy / dist) * s; d.z += (dz / dist) * s;
      if (Math.hypot(dx, dz) > 0.2) d.head = Math.atan2(dx, dz);
      return false;
    };
    if (!d.plan.length) d.plan = d.mission();
    const step = d.plan[0];
    let done = false;
    if (step.wait != null) { step.wait -= dt; done = step.wait <= 0; d.status = step.label || d.status; }
    else done = fly(step.x, step.y, step.z, step.sp || 2.2);
    if (step.scan) {
      d.status = step.label;
      d.scanning = true;
      if (d.indoor) {
        const passed = B.SLOTS.filter((s) => s.row === step.row && s.level === step.level && !s._counted && Math.abs(s.x - d.x) < 0.5);
        passed.forEach((s) => { s._counted = true; if (s.item >= 0) d.scans++; });
      } else d.scans += dt * 0.6;
    } else d.scanning = false;
    if (done) {
      if (step.after) step.after();
      d.plan.shift();
    }
    d.battery = Math.max(5, d.battery - dt * (d.y > d.padY + 0.05 ? 0.02 : -0.08));
    d.battery = Math.min(100, d.battery);
    u.cone.visible = d.scanning;
    if (d.scanning) u.cone.material.opacity = 0.12 + 0.08 * Math.sin(d.t * 18);
    d.mesh.position.set(d.x, d.y + Math.sin(d.t * 3) * 0.04, d.z);
    turn(d.mesh, d.head, dt);
  }

  function indoorMission(d) {
    const ri = Math.floor(Math.random() * RACK.rows.length), row = RACK.rows[ri];
    const lv = [1 + Math.floor(Math.random() * 2), 3 + Math.floor(Math.random() * 3)];
    const xa = RACK.x0 - 1.5, xb = RACK.x0 + RACK.bays * RACK.bayW + 1.5, cruise = 10.6;
    const plan = [{ x: d.padX, y: cruise, z: d.padZ, sp: 1.6, label: 'Taking off' }, { x: xa, y: cruise, z: row.access, label: 'Flying to row ' + row.letter }];
    lv.forEach((l, k) => {
      const y = (l - 1) * RACK.levelH + 0.9, from = k % 2 ? xb : xa, to = k % 2 ? xa : xb;
      plan.push({ x: from, y, z: row.access, sp: 1.4, label: 'Dropping into the aisle' });
      plan.push({ x: to, y, z: row.access, sp: 1.3, scan: true, row: ri, level: l, label: 'Cycle count: row ' + row.letter + ', level ' + l,
        after: () => { B.SLOTS.forEach((s) => { if (s.row === ri && s.level === l) s._counted = false; }); B.sim.addLog && B.sim.addLog('Drone D1 counted row ' + row.letter + ', level ' + l + ' (24 bays)', 'info'); } });
    });
    const last = lv.length % 2 ? xb : xa;
    plan.push({ x: last, y: cruise, z: row.access, sp: 1.6, label: 'Climbing above the racks' }, { x: d.padX, y: cruise, z: d.padZ, label: 'Returning to the pad' },
      { x: d.padX, y: d.padY, z: d.padZ, sp: 1.2, label: 'Landing' }, { wait: 8, label: 'Charging on the pad' });
    return plan;
  }
  function yardMission(d) {
    const zn = B.zoneById('YARD'), h = 16, plan = [{ x: d.padX, y: h, z: d.padZ, sp: 2, label: 'Taking off' }];
    for (let k = 0; k < 4; k++) {
      const x = zn.x[0] + 5 + k * 10;
      plan.push({ x, y: h, z: k % 2 ? zn.z[1] - 3 : zn.z[0] + 3, sp: 3, label: 'Positioning' });
      plan.push({ x, y: h, z: k % 2 ? zn.z[0] + 3 : zn.z[1] - 3, sp: 3.2, scan: true, label: 'Yard survey: counting pipe bundles, drums and containers' });
    }
    plan.push({ x: d.padX, y: h, z: d.padZ, sp: 3, label: 'Returning to the pad' }, { x: d.padX, y: d.padY, z: d.padZ, sp: 1.5, label: 'Landing' }, { wait: 10, label: 'Charging on the pad' });
    return plan;
  }

  function pad(scene, x, z) {
    const p = new T.Mesh(new T.CircleGeometry(1.1, 32), W.mat('#2b3138'));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.03, z);
    const ring = new T.Mesh(new T.RingGeometry(0.9, 1.05, 32), new T.MeshBasicMaterial({ color: '#f2b31b' }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.04, z);
    scene.add(p, ring);
  }

  B.drones = { makeDrone, updateDrone, indoorMission, yardMission, pad };
})();
