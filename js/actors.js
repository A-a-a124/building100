/* Building 19 - people and drones: named team members, hand-carry workers, inventory and yard drones */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = B.world;
  const A = (B.actors = { list: [] });
  const RACK = B.RACK;

  const CLOTH = (A.CLOTH = { beige: '#80694a', navy: '#050a1c', black: '#060607' }); // colours are lit in linear light, so they are set darker than they read on screen
  const SKIN = { dark: '#4b2f20', brown: '#6e4529', tan: '#a26e4a', arab: '#e0b994', fair: '#edc9a6' };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- low-poly person ----------
  function limb(w, h, d, color, y) {
    const g = new T.Group();
    // rounded limb: tapered cylinder with a ball joint at the top
    const m = new T.Mesh(new T.CylinderGeometry(w * 0.55, w * 0.46, h, 10), W.mat(color));
    m.scale.z = d / w; m.position.y = -h / 2; m.castShadow = true;
    const joint = new T.Mesh(new T.SphereGeometry(w * 0.56, 10, 8), W.mat(color));
    joint.scale.z = d / w; joint.castShadow = true;
    g.add(m, joint);
    g.position.y = y;
    return g;
  }
  function makePerson(o) {
    const h = o.height, gth = o.girth, s = h / 1.75;
    const g = new T.Group();
    const body = new T.Group();
    g.add(body);
    const legH = 0.86 * s, torsoH = 0.6 * s, hipW = 0.11 * gth;
    const pants = o.thobe ? '#f4f4f0' : o.pants || '#2f3a48';
    const legL = limb(0.15 * gth, legH, 0.17 * gth, pants, legH);
    const legR = limb(0.15 * gth, legH, 0.17 * gth, pants, legH);
    legL.position.x = -hipW;
    legR.position.x = hipW;
    [legL, legR].forEach((l) => { const shoe = W.box(0.15 * gth, 0.08, 0.24, '#1f1f1f'); shoe.position.set(0, -legH + 0.04, 0.03); const toe = new T.Mesh(new T.SphereGeometry(0.075 * gth, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), W.mat('#1f1f1f')); toe.scale.set(1, 0.9, 1.1); toe.position.set(0, -legH + 0.005, 0.15); l.add(shoe, toe); });
    body.add(legL, legR);
    const top = o.thobe ? '#f4f4f0' : o.shirt || '#ff8a1f';
    let kitVest = [];
    // shaped torso: wider at the chest, rounded front and back, with a neck
    const torso = new T.Mesh(new T.CylinderGeometry(0.235 * gth, 0.2 * gth, torsoH, 16), W.mat(top));
    torso.scale.z = 0.6; torso.position.y = legH + torsoH / 2; torso.castShadow = true;
    const chest = new T.Mesh(new T.SphereGeometry(0.235 * gth, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), W.mat(top));
    chest.scale.set(1, 0.32, 0.6); chest.position.y = legH + torsoH; chest.castShadow = true;
    const neck = new T.Mesh(new T.CylinderGeometry(0.05 * s, 0.058 * s, 0.1 * s, 10), W.mat(o.skin));
    neck.position.y = legH + torsoH + 0.05 * s;
    body.add(torso, chest, neck);
    if (o.thobe) {
      // long white thobe down to the ankles
      const skirt = new T.Mesh(new T.CylinderGeometry(0.27 * gth, 0.33 * gth, legH * 0.95, 14), W.mat('#f4f4f0'));
      skirt.position.y = legH * 0.52;
      skirt.castShadow = true;
      body.add(skirt);
    } else if (o.vest) {
      kitVest = [];
      // reflective bands wrapped round the vest, plus shoulder straps
      [0.35, 0.65].forEach((k) => { const r = 0.2 * gth + 0.035 * gth * k + 0.008; const band = new T.Mesh(new T.CylinderGeometry(r, r, 0.04, 16, 1, true), W.mat('#e6e9ec', { emissive: '#ffffff', emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.3 })); band.scale.z = 0.62; band.position.y = legH + torsoH * k; body.add(band); kitVest.push(band); });
      [-1, 1].forEach((sd) => { const strap = W.box(0.05, torsoH * 0.95, 0.02, '#e6e9ec', { emissive: '#ffffff', emissiveIntensity: 0.3 }); strap.position.set(sd * 0.1 * gth, legH + torsoH * 0.5, 0.145 * gth); body.add(strap); kitVest.push(strap); });
    }
    if (gth > 1.2) {
      const belly = new T.Mesh(new T.SphereGeometry(0.2 * gth, 14, 10), W.mat(top));
      belly.scale.set(1, 1.05, 0.75);
      belly.position.set(0, legH + torsoH * 0.38, 0.1 * gth);
      belly.castShadow = true;
      body.add(belly);
    }
    const shoulder = legH + torsoH - 0.05;
    // two-part arms with an elbow, so hands can lift a glass or hold a carton naturally
    const aw = 0.11 * Math.min(gth, 1.25);
    const mkArm = (side) => {
      const up = limb(aw, 0.32 * s, 0.12, top, shoulder);
      up.position.x = side * (0.22 * gth + 0.06);
      const elbow = limb(aw * 0.92, 0.3 * s, 0.11, o.thobe ? top : o.skin === SKIN.dark || !o.vest ? top : top, -0.32 * s);
      const hand = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), W.mat(o.skin));
      hand.position.y = -0.31 * s;
      elbow.add(hand);
      up.add(elbow);
      up.userData.elbow = elbow;
      return up;
    };
    const armL = mkArm(-1), armR = mkArm(1);
    body.add(armL, armR);
    const head = new T.Mesh(new T.SphereGeometry(0.115 * s, 18, 14), W.mat(o.skin));
    head.position.y = legH + torsoH + 0.15 * s;
    head.castShadow = true;
    body.add(head);
    const hy = head.position.y, kitHat = [];
    if (o.hat === 'helmet') {
      const hat = new T.Mesh(new T.SphereGeometry(0.13 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), W.mat(o.hatColor || '#f2c21b'));
      hat.position.y = hy + 0.02;
      const brim = new T.Mesh(new T.CylinderGeometry(0.15 * s, 0.15 * s, 0.015, 18), W.mat(o.hatColor || '#f2c21b'));
      brim.position.y = hy + 0.02;
      body.add(hat, brim); kitHat.push(hat, brim);
    } else if (o.hat === 'cap') {
      const cap = new T.Mesh(new T.SphereGeometry(0.122 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), W.mat(o.hatColor || '#1d3b6e'));
      cap.position.y = hy + 0.02;
      const peak = W.box(0.17 * s, 0.015, 0.13 * s, o.hatColor || '#1d3b6e');
      peak.position.set(0, hy + 0.03, 0.15 * s);
      body.add(cap, peak);
    } else if (o.hat === 'ghutra') {
      const cloth = new T.Mesh(new T.SphereGeometry(0.135 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), W.mat('#fbfbf8'));
      cloth.position.y = hy;
      const drape = W.box(0.3 * s, 0.32 * s, 0.05, '#fbfbf8');
      drape.position.set(0, hy - 0.12 * s, -0.11 * s);
      const agal = new T.Mesh(new T.TorusGeometry(0.11 * s, 0.014, 8, 24), W.mat('#151515'));
      agal.rotation.x = Math.PI / 2;
      agal.position.y = hy + 0.085 * s;
      body.add(cloth, drape, agal);
    }
    if (o.label) {
      const tag = W.makeLabel(o.label, { size: 0.62, bg: 'rgba(242,179,27,0.96)', fg: '#1a1300', weight: 700 });
      tag.position.y = hy + 0.55;
      g.add(tag);
    }
    W.mergeStatic(g, new Set([...kitHat, ...kitVest, head]));
    g.userData = { kitHat, kitVest, legL, legR, armL, armR, elbowL: armL.userData.elbow, elbowR: armR.userData.elbow, body, head, legH, s, tag: g.children.find((c) => c.isSprite) };
    return g;
  }
  A.makePerson = makePerson;
  function makeBox(color) { return W.box(0.42, 0.3, 0.34, color || '#c79a5b'); }

  // ---------- behaviours ----------
  function walker(def) {
    const mesh = makePerson(def.look);
    const a = Object.assign({ kind: 'person', mesh, x: def.route[0].x, z: def.route[0].z, i: 0, wait: 0, carry: null, phase: 0, head: 0, trips: 0, status: 'Walking' }, def);
    mesh.position.set(a.x, 0, a.z);
    return a;
  }
  function updateWalker(a, dt) {
    const u = a.mesh.userData;
    if (B.env && B.env.onBreak()) { a.wait = Math.max(a.wait, 0.3); a.status = 'On a lunch break'; }
    if (a.wait > 0) {
      a.wait -= dt;
      a.phase *= 0.9;
    } else {
      const p = a.route[a.i];
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
      const step = a.speed * dt;
      if (d <= step) {
        a.x = p.x; a.z = p.z;
        if (p.pick) { a.carry = makeBox(a.boxColor); a.carry.position.set(0, u.legH + 0.42 * u.s, 0.32); u.body.add(a.carry); a.wait = p.wait || 2; a.status = 'Picking a carton'; }
        else if (p.drop) { if (a.carry) u.body.remove(a.carry); a.carry = null; a.wait = p.wait || 1.5; a.trips++; a.status = 'Setting down a carton'; }
        else a.status = a.carry ? 'Carrying a carton' : 'Walking back for the next carton';
        a.i = (a.i + 1) % a.route.length;
      } else {
        a.x += (dx / d) * step; a.z += (dz / d) * step;
        a.head = Math.atan2(dx, dz);
        a.phase += dt * a.speed * 5.2;
        if (!a.carry) a.status = 'Walking back for the next carton'; else a.status = 'Carrying a carton';
      }
    }
    const sw = Math.sin(a.phase) * 0.55 * (a.wait > 0 ? 0 : 1);
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    if (a.carry) { u.armL.rotation.x = u.armR.rotation.x = -0.75; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.85; }
    else { u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.25; }
    a.mesh.position.set(a.x, Math.abs(Math.sin(a.phase)) * 0.03, a.z);
    turn(a.mesh, a.head, dt);
  }
  function turn(mesh, target, dt) {
    let d = target - mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    mesh.rotation.y += d * Math.min(1, dt * 6);
  }

  // walk a.path at a.speed; returns true when the last point is reached
  function walkPath(a, dt) {
    const p = a.path[0];
    if (!p) return true;
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), st = a.speed * dt;
    if (d <= st) { a.x = p.x; a.z = p.z; a.path.shift(); }
    else { a.x += (dx / d) * st; a.z += (dz / d) * st; a.head = Math.atan2(dx, dz); }
    a.phase = (a.phase || 0) + dt * a.speed * 5.2;
    return a.path.length === 0;
  }
  function officePoints() {
    const o = B.zoneById('OFF');
    const doorX = o.x[1] - 1.5, coffee = { x: o.x[0] + 1.2, z: o.z[0] + 1.2 };
    return { out: { x: doorX, z: o.z[1] + 0.8 }, inside: { x: doorX, z: o.z[1] - 1.0 }, back: { x: doorX, z: o.z[0] + 3.2 }, coffee,
      spot2: { x: coffee.x + 1.3, z: coffee.z + 0.7 }, spot3: { x: coffee.x + 0.3, z: coffee.z + 1.7 } };
  }
  function legsAndArms(u, walking, phase) {
    const sw = walking ? Math.sin(phase) * 0.5 : 0;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.8; u.elbowL.rotation.x = -0.2;
    return sw;
  }

  // Abdullah: trainee at the desk beside Nasser; goes to the coffee corner with him and walks out to observe the floor
  function updateWatcher(a, dt) {
    const u = a.mesh.userData;
    a.t += dt;
    const nasser = A.byId('nasser'), P = officePoints(), gap = { x: a.seat.x - 1.6, z: a.seat.z + 0.2 }, gap2 = { x: a.seat.x - 1.6, z: nasser.coffee.z + 2.0 };
    const aisle = { x: a.seat.x, z: P.inside.z };
    if (a.state === 'desk' && nasser.state === 'toCoffee') { a.state = 'toCoffee'; a.t = 0; a.path = [gap, gap2, P.spot2]; }
    else if (a.state === 'desk' && a.t > 34 && nasser.state === 'desk' && nasser.t < 25) { a.state = 'toFloor'; a.t = 0; a.path = [aisle, P.inside, P.out, { x: a.homeX, z: a.homeZ }]; }
    if (a.state === 'toCoffee' || a.state === 'toFloor' || a.state === 'backFromCoffee' || a.state === 'backFromFloor') {
      const done = walkPath(a, dt), sw = Math.sin(a.phase) * 0.5;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.2;
      a.status = { toCoffee: 'Going to the coffee corner with Nasser', toFloor: 'Walking out to observe the warehouse', backFromCoffee: 'Returning to the computer', backFromFloor: 'Returning to the computer' }[a.state];
      if (done) { a.state = a.state === 'toCoffee' ? 'coffee' : a.state === 'toFloor' ? 'watch' : 'desk'; a.t = 0; }
      a.mesh.position.set(a.x, Math.abs(Math.sin(a.phase)) * 0.03, a.z);
      turn(a.mesh, a.head, dt);
      return;
    }
    const sitting = a.state === 'desk';
    if (a.state === 'coffee') {
      a.head = Math.atan2(nasser.x - a.x, nasser.z - a.z);
      a.status = 'At the coffee corner with Nasser';
      if (nasser.state === 'back' || nasser.state === 'desk') { a.state = 'backFromCoffee'; a.t = 0; a.path = [gap2, gap, { x: a.seat.x, z: a.seat.z }]; }
    } else if (a.state === 'watch') {
      const watch = A.list.filter((q) => q.watched).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
      if (watch) a.head = Math.atan2(watch.x - a.x, watch.z - a.z);
      a.status = 'Observing the warehouse floor';
      if (a.t > 18) { a.state = 'backFromFloor'; a.t = 0; a.path = [P.out, P.inside, aisle, { x: a.seat.x, z: a.seat.z }]; }
    } else { a.head = Math.PI; a.status = 'Working at the computer'; }
    u.legL.rotation.x = u.legR.rotation.x = sitting ? -1.45 : 0;
    u.armL.rotation.x = u.armR.rotation.x = sitting ? -0.55 : 0.05;
    u.elbowL.rotation.x = u.elbowR.rotation.x = sitting ? -0.95 : -0.15;
    a.mesh.position.set(a.x, sitting ? -0.36 * u.s : 0, a.z);
    turn(a.mesh, a.head, dt);
  }

  // Nasser: works at his computer, gets up only to make coffee
  function updateDesk(a, dt) {
    const u = a.mesh.userData;
    a.t += dt;
    const st = a.state;
    const go = (tx, tz) => {
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz), s = a.speed * dt;
      if (d <= s) { a.x = tx; a.z = tz; return true; }
      a.x += (dx / d) * s; a.z += (dz / d) * s; a.head = Math.atan2(dx, dz); a.phase += dt * a.speed * 5.2;
      return false;
    };
    let sitting = false, walking = false;
    const gap = { x: a.seat.x + 1.6, z: a.seat.z + 0.2 }, gap2 = { x: a.seat.x + 1.6, z: a.coffee.z + 2.0 };
    if (st === 'desk') { sitting = true; a.head = Math.PI; a.status = 'Working at the computer'; if (a.t > 45) { a.state = 'toCoffee'; a.t = 0; a.path = [gap, gap2, { x: a.coffee.x, z: a.coffee.z }]; } }
    else if (st === 'toCoffee') { walking = true; a.status = 'Going to make coffee'; if (walkPath(a, dt)) { a.state = 'brew'; a.t = 0; } }
    else if (st === 'brew') {
      a.head = Math.PI; a.status = 'Making coffee';
      const ab = A.byId('abdullah'), waiting = ab && (ab.state === 'toCoffee' || (ab.state === 'coffee' && ab.t < 6));
      if (waiting && ab.state === 'coffee') { a.head = Math.atan2(ab.x - a.x, ab.z - a.z); a.status = 'At the coffee corner with Abdullah'; }
      if (a.t > 5 && !waiting) { a.state = 'back'; a.t = 0; a.cup.visible = true; a.path = [gap2, gap, { x: a.seat.x, z: a.seat.z }]; }
    }
    else if (st === 'back') { walking = true; a.status = 'Returning to the computer'; if (walkPath(a, dt)) { a.state = 'desk'; a.t = 0; a.cup.visible = false; } }
    const sw = walking ? Math.sin(a.phase) * 0.5 : 0;
    u.legL.rotation.x = sitting ? -1.45 : sw;
    u.legR.rotation.x = sitting ? -1.45 : -sw;
    u.armL.rotation.x = sitting ? -0.55 : -sw * 0.8;
    u.armR.rotation.x = sitting ? -0.55 : a.cup.visible ? -0.3 : sw * 0.8;
    u.elbowL.rotation.x = sitting ? -0.95 : -0.2;
    u.elbowR.rotation.x = sitting ? -0.95 : a.cup.visible ? -1.4 : -0.2;
    a.mesh.position.set(a.x, sitting ? -0.36 * u.s : 0, a.z);
    turn(a.mesh, a.head, dt);
  }

  // Ghazi: supervisor on floor rounds, stops with each team member in turn
  function hub(p) {
    if (p.x > 42) return { x: 45.8, z: p.z };
    if (p.z > 26) return { x: p.x, z: 30.4 };
    return { x: p.x, z: -25.8 };
  }
  function planTo(a, t) {
    const from = hub(a), to = hub(t), C1 = { x: 45.8, z: -25.8 }, C2 = { x: 45.8, z: 30.4 };
    const side = (p) => (p.x > 42 ? 'e' : p.z > 26 ? 's' : 'n');
    const sa = side(a), sb = side(t), path = [from];
    if (sa !== sb) {
      if (sa === 'n') path.push(C1); if (sa === 's') path.push(C2);
      if (sa === 'n' && sb === 's') path.push(C2);
      if (sa === 's' && sb === 'n') path.push(C1);
      if (sa === 'e') path.push(sb === 'n' ? C1 : C2);
    }
    path.push(to);
    return path;
  }
  // the office is glass: people go in and out through the door, never through the wall
  function inOffice(p) { const o = B.zoneById('OFF'); return p.x > o.x[0] - 0.3 && p.x < o.x[1] + 0.3 && p.z > o.z[0] - 0.3 && p.z < o.z[1] + 0.3; }
  function crossesOffice(a, b) { for (let k = 1; k < 12; k++) { const t = k / 12; if (inOffice({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return true; } return false; }
  function routeTo(a, cs) {
    const P = officePoints(), aIn = inOffice(a), cIn = inOffice(cs);
    if (aIn && cIn) return [cs];
    if (aIn) return [P.inside, P.out].concat(planTo(P.out, cs), [cs]);
    if (cIn) return planTo(a, P.out).concat([P.out, P.inside, cs]);
    return planTo(a, cs).concat([cs]);
  }
  function chatSpot(t) {
    if (t.id === 'nasser') { const o = B.zoneById('OFF'); return { x: t.seat.x, z: o.z[1] + 0.9 }; }
    return { x: t.x + 1.1, z: t.z + 0.6 };
  }
  // next person to visit: the nearest one not seen recently
  function pickNext(a, others) {
    a.recent = a.recent || [];
    let pool = others.filter((q) => !a.recent.includes(q.id));
    const near = pool.filter((q) => Math.hypot(q.x - a.x, q.z - a.z) < 35);
    if (near.length) pool = near;
    const next = pool.sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0] || others[0];
    a.recent.push(next.id);
    if (a.recent.length > 4) a.recent.shift();
    a.ti = others.indexOf(next);
  }
  function updateChatter(a, dt) {
    const u = a.mesh.userData;
    a.t += dt;
    const others = A.list.filter((q) => q.kind === 'person' && q !== a);
    if (a.ti < 0) pickNext(a, others);
    const tgt = others[a.ti % others.length];
    let walking = false;
    if (a.state === 'chat') {
      a.head = Math.atan2(tgt.x - a.x, tgt.z - a.z);
      const g = Math.sin(a.t * 5);
      u.armR.rotation.x = -0.45 + 0.3 * g; u.armR.rotation.z = 0.15; u.elbowR.rotation.x = -1.1 - 0.4 * g;
      u.armL.rotation.x = -0.2 - 0.2 * Math.sin(a.t * 3.3); u.elbowL.rotation.x = -0.6;
      u.legL.rotation.x = u.legR.rotation.x = 0;
            a.status = 'Checking in with ' + (tgt.anon ? 'a warehouse worker' : tgt.name);
      // workers stop what they are doing and turn to him
      if (tgt.update === updateWalker) { tgt.wait = Math.max(tgt.wait, 0.25); tgt.head = Math.atan2(a.x - tgt.x, a.z - tgt.z); tgt.status = 'Talking with the supervisor'; }
      if (a.t > 6.5 || Math.hypot(tgt.x - a.x, tgt.z - a.z) > 4) {
        pickNext(a, others); a.t = 0; u.armR.rotation.z = 0;
        a.state = 'go'; a.path = null;
      }
    } else {
      // give up on anyone he cannot catch and try the next person
      if (a.t > 15) { pickNext(a, others); a.t = 0; a.path = null; }
      const tgt2 = others[a.ti % others.length];
      if (tgt2 !== tgt) return;
      const cs = chatSpot(tgt);
      a.rp = (a.rp || 0) + dt;
      const moved = !a.goal || Math.hypot(cs.x - a.goal.x, cs.z - a.goal.z) > 1.5;
      if (!a.path || (a.rp > 2 && moved)) { a.rp = 0; a.goal = cs; a.path = routeTo(a, cs); }
      // close enough: walk straight at the person
      if (Math.hypot(cs.x - a.x, cs.z - a.z) < (tgt.id === 'nasser' ? 3.5 : 9) && !crossesOffice(a, cs)) a.path = [cs];
      const p = a.path[0];
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), st = a.speed * dt;
      if (d <= st) { a.x = p.x; a.z = p.z; a.path.shift(); }
      else { a.x += (dx / d) * st; a.z += (dz / d) * st; a.head = Math.atan2(dx, dz); }
      walking = true;
      a.phase += dt * a.speed * 5.2;
      if (!a.path.length) {
        const c = chatSpot(tgt);
        if (Math.hypot(c.x - a.x, c.z - a.z) < 2.2) { a.state = 'chat'; a.t = 0; } else a.path = null;
      }
      a.status = 'On floor rounds, walking to ' + (tgt.anon ? 'a warehouse worker' : tgt.name);
      const sw = Math.sin(a.phase) * 0.5;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.25;
    }
    a.mesh.position.set(a.x, walking ? Math.abs(Math.sin(a.phase)) * 0.03 : 0, a.z);
    turn(a.mesh, a.head, dt);
  }

  // ---------- build ----------
  A.build = function (scene) {
    const off = B.zoneById('OFF'), cz = (off.z[0] + off.z[1]) / 2;
    const ex = 44.6, dspZ = 31.2, frontZ = -25.0;
    const people = [
      { id: 'mansour', name: 'Mansour', role: '', watched: true, speed: 1.35, boxColor: '#c79a5b', about: '',
        look: { height: 1.93, girth: 0.8, skin: SKIN.dark, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet', label: 'Mansour' },
        route: [{ x: 49.5, z: -22, pick: true }, { x: ex, z: -22 }, { x: ex, z: dspZ }, { x: 20, z: dspZ, drop: true }, { x: ex, z: dspZ }, { x: ex, z: -22 }] },
      { id: 'mohsen', name: 'Mohsen', role: '', watched: true, speed: 1.0, boxColor: '#b98a4e', about: '',
        look: { height: 1.6, girth: 1.18, skin: SKIN.brown, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet', label: 'Mohsen' },
        route: [{ x: -47, z: -31.2, pick: true }, { x: -47, z: frontZ }, { x: ex + 0.8, z: frontZ }, { x: ex + 0.8, z: -12 }, { x: 49.5, z: -12, drop: true }, { x: ex + 0.8, z: -12 }, { x: ex + 0.8, z: frontZ }, { x: -47, z: frontZ }] },
      { id: 'w1', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.2, boxColor: '#d4a86a', anon: true,
        about: 'Pushes a hand cart of light cartons from the small parts store to the shipping lanes.',
        look: { height: 1.74, girth: 1.0, skin: SKIN.tan, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet', hatColor: '#ffffff' },
        route: [{ x: 49.5, z: -30, pick: true }, { x: ex - 0.8, z: -30 }, { x: ex - 0.8, z: dspZ + 0.8 }, { x: 4, z: dspZ + 0.8, drop: true }, { x: ex - 0.8, z: dspZ + 0.8 }, { x: ex - 0.8, z: -30 }] },
      { id: 'w2', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.25, boxColor: '#c08c50', anon: true,
        about: 'Carries inspected small parts from quality inspection back to receiving.',
        look: { height: 1.7, girth: 1.05, skin: SKIN.fair, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet', hatColor: '#3a8bd8' },
        route: [{ x: -54, z: -19, pick: true }, { x: -54, z: frontZ }, { x: -38, z: frontZ }, { x: -38, z: -30.5, drop: true }, { x: -38, z: frontZ }, { x: -54, z: frontZ }] },
      { id: 'w3', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.15, boxColor: '#d9b27a', anon: true,
        about: 'Takes small cartons from the shelving to the shipping marshalling area.',
        look: { height: 1.8, girth: 0.95, skin: SKIN.brown, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet' },
        route: [{ x: 49.5, z: -6, pick: true }, { x: ex + 1.6, z: -6 }, { x: ex + 1.6, z: dspZ - 0.8 }, { x: 32, z: dspZ - 0.8, drop: true }, { x: ex + 1.6, z: dspZ - 0.8 }, { x: ex + 1.6, z: -6 }] },
    ].map(walker);
    // hand cart for the first unnamed worker
    const cart = new T.Group();
    const deck = W.box(0.7, 0.06, 1.0, '#4a5560');
    deck.position.set(0, 0.2, 0.75);
    const handle = W.box(0.6, 0.9, 0.04, '#4a5560');
    handle.position.set(0, 0.62, 0.27);
    const load = W.box(0.5, 0.45, 0.6, '#c79a5b');
    load.position.set(0, 0.46, 0.8);
    cart.add(deck, handle, load);
    people[2].mesh.add(cart);
    people[2].cartLoad = load;

    // Nasser's desk, computer and the coffee corner in the office
    const seat = { x: off.x[0] + 5.2, z: cz + 2.25 }, coffee = { x: off.x[0] + 1.2, z: off.z[0] + 1.2 };
    const monitor = W.box(0.6, 0.38, 0.05, '#11161b', { emissive: '#2a6fb5', emissiveIntensity: 0.6 });
    monitor.position.set(seat.x, 1.0, seat.z - 0.85);
    const chair = W.box(0.5, 0.5, 0.5, '#2c3440');
    chair.position.set(seat.x, 0.25, seat.z + 0.05);
    const machine = W.box(0.5, 0.75, 0.45, '#3a3f45', { metalness: 0.5 });
    machine.position.set(coffee.x, 1.15, coffee.z - 0.6);
    const counter = W.box(1.4, 0.9, 0.6, '#6b4f3a');
    counter.position.set(coffee.x, 0.45, coffee.z - 0.6);
    scene.add(monitor, chair, machine, counter);
    // Abdullah's desk is the next one along, with his own computer
    const seat2 = { x: seat.x + 3.2, z: seat.z };
    const monitor2 = W.box(0.6, 0.38, 0.05, '#11161b', { emissive: '#2a6fb5', emissiveIntensity: 0.6 });
    monitor2.position.set(seat2.x, 1.0, seat2.z - 0.85);
    const chair2 = W.box(0.5, 0.5, 0.5, '#2c3440');
    chair2.position.set(seat2.x, 0.25, seat2.z + 0.05);
    scene.add(monitor2, chair2);
    const abdullah = { id: 'abdullah', kind: 'person', name: 'Abdullah', role: 'Trainee', x: seat2.x, z: seat2.z, homeX: -2, homeZ: -25.2, seat: seat2, head: Math.PI, t: 0, state: 'desk', speed: 1.3, phase: 0, path: null, about: '',
      mesh: makePerson({ height: 1.88, girth: 1.15, skin: SKIN.arab, shirt: CLOTH.beige, pants: CLOTH.black, vest: true, hat: 'helmet', hatColor: '#ffffff', label: 'Abdullah · Trainee' }), update: updateWatcher, status: 'Working at the computer' };
    abdullah.mesh.position.set(seat2.x, 0, seat2.z);
    const nasser = { id: 'nasser', kind: 'person', name: 'Nasser', role: '', x: seat.x, z: seat.z, head: Math.PI, t: 0, state: 'desk', speed: 0.9, phase: 0, seat, coffee,
      about: '',
      mesh: makePerson({ height: 1.62, girth: 1.0, skin: SKIN.fair, shirt: CLOTH.navy, pants: CLOTH.black, hat: 'cap', hatColor: '#14284b', label: 'Nasser' }), update: updateDesk, status: 'Working at the computer' };
    nasser.cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.1, 12), W.mat('#f2f2f2'));
    nasser.cup.position.set(0, -0.33 * nasser.mesh.userData.s, 0.06);
    nasser.cup.visible = false;
    nasser.mesh.userData.elbowR.add(nasser.cup);
    nasser.mesh.position.set(seat.x, 0, seat.z);

    const ghazi = { id: 'ghazi', kind: 'person', name: 'Ghazi', role: 'Supervisor', x: 10, z: -25.8, head: 0, t: 0, ti: -1, state: 'go', speed: 1.7, phase: 0, path: null,
      about: '',
      mesh: makePerson({ height: 1.76, girth: 1.08, skin: SKIN.tan, shirt: CLOTH.navy, pants: CLOTH.black, hat: 'helmet', hatColor: '#ffffff', label: 'Ghazi · Supervisor' }), update: updateChatter, status: 'On floor rounds' };
    ghazi.mesh.position.set(ghazi.x, 0, ghazi.z);

    const chg = B.zoneById('CHG'), yz = B.zoneById('YARD');
    const d1 = { id: 'd1', kind: 'drone', name: 'Drone D1', role: 'Indoor inventory drone', indoor: true, padX: chg.x[1] + 2.5, padY: 0.12, padZ: chg.z[0] + 2.5, plan: [], scans: 0, battery: 92, t: 0, head: 0,
      about: 'Flies the rack aisles and reads pallet labels for cycle counts, without a person on a lift.', mission: null, mesh: B.drones.makeDrone('#f2b31b'), status: 'Charging on the pad' };
    d1.mission = () => B.drones.indoorMission(d1);
    const d2 = { id: 'd2', kind: 'drone', name: 'Drone D2', role: 'Yard survey drone', indoor: false, padX: yz.x[0] + 3, padY: 0.12, padZ: 0, plan: [], scans: 0, battery: 88, t: 0, head: 0,
      about: 'Surveys the open yard from 16 m and counts pipe bundles, drums and containers.', mission: null, mesh: B.drones.makeDrone('#58d0ff'), status: 'Charging on the pad' };
    d2.mission = () => B.drones.yardMission(d2);
    [d1, d2].forEach((d) => { d.x = d.padX; d.y = d.padY; d.z = d.padZ; d.mesh.scale.setScalar(d.indoor ? 1.3 : 2.2); B.drones.pad(scene, d.padX, d.padZ); d.update = B.drones.updateDrone; });
    d2.plan = [{ wait: 3, label: 'Pre-flight checks' }];

    people.forEach((p) => (p.update = updateWalker));
    A.list = [...people, abdullah, nasser, ghazi, d1, d2];
    A.list.forEach((a) => {
      a.mesh.traverse((o) => (o.userData.pick = { type: 'actor', id: a.id }));
      W.pickables.push(a.mesh);
      scene.add(a.mesh);
    });
  };

  A.byId = (id) => A.list.find((a) => a.id === id);
  A.showTags = (on) => A.list.forEach((a) => { const t = a.mesh.userData.tag; if (t) t.visible = on; });
  A.tagsShown = () => { const q = A.list.find((a) => a.mesh.userData.tag); return !q || q.mesh.userData.tag.visible; };
  A.update = function (dt) { A.list.forEach((a) => a.update(a, dt)); };
  A.y = (a) => (a.kind === 'drone' ? a.y : 1.2);
})();
