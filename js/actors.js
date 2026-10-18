/* Building 100 - people and drones: named team members, hand-carry workers, inventory and yard drones */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = B.world;
  const A = (B.actors = { list: [] });
  const RACK = B.RACK;

  const SKIN = { dark: '#4b2f20', brown: '#6e4529', tan: '#a26e4a', arab: '#e0b994', fair: '#edc9a6' };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- low-poly person ----------
  function limb(w, h, d, color, y) {
    const g = new T.Group();
    const m = W.box(w, h, d, color);
    m.position.y = -h / 2;
    g.add(m);
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
    [legL, legR].forEach((l) => { const shoe = W.box(0.16 * gth, 0.08, 0.28, '#1f1f1f'); shoe.position.set(0, -legH + 0.04, 0.05); l.add(shoe); });
    body.add(legL, legR);
    const top = o.thobe ? '#f4f4f0' : o.shirt || '#ff8a1f';
    const torso = W.box(0.44 * gth, torsoH, 0.26 * gth, top);
    torso.position.y = legH + torsoH / 2;
    body.add(torso);
    if (o.thobe) {
      // long white thobe down to the ankles
      const skirt = new T.Mesh(new T.CylinderGeometry(0.27 * gth, 0.33 * gth, legH * 0.95, 14), W.mat('#f4f4f0'));
      skirt.position.y = legH * 0.52;
      skirt.castShadow = true;
      body.add(skirt);
    } else if (o.vest) {
      [0.35, 0.65].forEach((k) => { const band = W.box(0.45 * gth, 0.035, 0.27 * gth, '#d9dde1', { emissive: '#ffffff', emissiveIntensity: 0.25 }); band.position.y = legH + torsoH * k; body.add(band); });
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
    const hy = head.position.y;
    if (o.hat === 'helmet') {
      const hat = new T.Mesh(new T.SphereGeometry(0.13 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), W.mat(o.hatColor || '#f2c21b'));
      hat.position.y = hy + 0.02;
      const brim = new T.Mesh(new T.CylinderGeometry(0.15 * s, 0.15 * s, 0.015, 18), W.mat(o.hatColor || '#f2c21b'));
      brim.position.y = hy + 0.02;
      body.add(hat, brim);
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
    g.userData = { legL, legR, armL, armR, elbowL: armL.userData.elbow, elbowR: armR.userData.elbow, body, head, legH, s, tag: g.children.find((c) => c.isSprite) };
    return g;
  }
  function makeBox(color) { return W.box(0.42, 0.3, 0.34, color || '#c79a5b'); }

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

  // ---------- behaviours ----------
  function walker(def) {
    const mesh = makePerson(def.look);
    const a = Object.assign({ kind: 'person', mesh, x: def.route[0].x, z: def.route[0].z, i: 0, wait: 0, carry: null, phase: 0, head: 0, trips: 0, status: 'Walking' }, def);
    mesh.position.set(a.x, 0, a.z);
    return a;
  }
  function updateWalker(a, dt) {
    const u = a.mesh.userData;
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

  // Abdullah: co-op student who watches the team with a glass of tea and joins Nasser for coffee
  function updateWatcher(a, dt) {
    const u = a.mesh.userData;
    a.t += dt;
    const nasser = A.byId('nasser');
    const P = officePoints();
    if (a.state === 'watch' && nasser && nasser.state === 'toCoffee') { a.state = 'toCoffee'; a.t = 0; a.path = [P.out, P.inside, P.back, P.spot2]; }
    if (a.state === 'toCoffee' || a.state === 'return') {
      const done = walkPath(a, dt);
      legsAndArms(u, true, a.phase);
      u.armR.rotation.x = -0.2; u.armR.rotation.z = -0.12; u.elbowR.rotation.x = -1.45;
      a.status = a.state === 'toCoffee' ? 'Heading to the coffee machine with Nasser' : 'Back to watching the floor';
      if (done) { a.state = a.state === 'toCoffee' ? 'coffee' : 'watch'; a.t = 0; }
      a.mesh.position.set(a.x, Math.abs(Math.sin(a.phase)) * 0.03, a.z);
      turn(a.mesh, a.head, dt);
      return;
    }
    if (a.state === 'coffee') {
      a.head = Math.atan2(nasser.x - a.x, nasser.z - a.z);
      if (nasser.state === 'back' || nasser.state === 'desk') { a.state = 'return'; a.t = 0; a.path = [P.back, P.inside, P.out, { x: a.homeX, z: a.homeZ }]; }
    }
    legsAndArms(u, false, 0);
    a.mesh.position.set(a.x, 0, a.z);
    const watch = A.list.filter((q) => q.watched).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    if (a.state === 'watch' && watch) a.head = Math.atan2(watch.x - a.x, watch.z - a.z);
    turn(a.mesh, a.head, dt * 0.5);
    const sip = (a.t % 7) / 7, k = sip < 0.12 ? sip / 0.12 : sip < 0.3 ? 1 : sip < 0.42 ? 1 - (sip - 0.3) / 0.12 : 0;
    u.armR.rotation.x = lerp(-0.2, -0.75, k);
    u.armR.rotation.z = lerp(-0.12, -0.3, k);
    u.elbowR.rotation.x = lerp(-1.45, -2.35, k);
    u.armL.rotation.x = 0.05;
    u.elbowL.rotation.x = -0.15;
    if (a.state === 'coffee') a.status = 'Having coffee with Nasser';
    else a.status = k > 0.5 ? 'Sipping tea' : watch ? 'Watching ' + watch.name : 'Watching the floor';
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
    if (st === 'desk') { sitting = true; a.head = Math.PI; a.status = 'Working at his computer'; if (a.t > 22) { a.state = 'toCoffee'; a.t = 0; a.path = [gap, gap2, { x: a.coffee.x, z: a.coffee.z }]; } }
    else if (st === 'toCoffee') { walking = true; a.status = 'Going to make coffee'; if (walkPath(a, dt)) { a.state = 'brew'; a.t = 0; } }
    else if (st === 'brew') {
      a.head = Math.PI; a.status = 'Making coffee';
      const ab = A.byId('abdullah'), waiting = ab && (ab.state === 'toCoffee' || (ab.state === 'coffee' && ab.t < 6));
      if (waiting && ab.state === 'coffee') { a.head = Math.atan2(ab.x - a.x, ab.z - a.z); a.status = 'Chatting with Abdullah over coffee'; }
      if (a.t > 5 && !waiting) { a.state = 'back'; a.t = 0; a.cup.visible = true; a.path = [gap2, gap, { x: a.seat.x, z: a.seat.z }]; }
    }
    else if (st === 'back') { walking = true; a.status = 'Back to his desk with a coffee'; if (walkPath(a, dt)) { a.state = 'desk'; a.t = 0; a.cup.visible = false; } }
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

  // Ghazi: wanders from person to person for a chat and never carries anything
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
  function chatSpot(t) {
    if (t.id === 'nasser') { const o = B.zoneById('OFF'); return { x: t.seat.x, z: o.z[1] + 0.9 }; }
    return { x: t.x + 1.1, z: t.z + 0.6 };
  }
  // next person to visit: the nearest one he has not talked to recently
  function pickNext(a, others) {
    a.recent = a.recent || [];
    const pool = others.filter((q) => !a.recent.includes(q.id));
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
      a.bubble.visible = Math.floor(a.t * 1.6) % 3 !== 2;
      a.status = 'Chatting with ' + (tgt.anon ? 'a warehouse worker' : tgt.name);
      // workers stop what they are doing and turn to him
      if (tgt.update === updateWalker) { tgt.wait = Math.max(tgt.wait, 0.25); tgt.head = Math.atan2(a.x - tgt.x, a.z - tgt.z); tgt.status = 'Being chatted to by Ghazi'; }
      if (a.t > 6.5 || Math.hypot(tgt.x - a.x, tgt.z - a.z) > 4) {
        pickNext(a, others); a.chats = (a.chats || 0) + 1; a.t = 0; a.bubble.visible = false; u.armR.rotation.z = 0;
        const P = officePoints();
        if (a.chats % 3 === 0) { a.state = 'toCoffee'; a.path = planTo(a, P.out).concat([P.out, P.inside, P.back, P.spot3]); }
        else { a.state = 'go'; a.path = null; if (a.chats % 3 === 2) a.cup.visible = false; }
      }
    } else if (a.state === 'toCoffee' || a.state === 'leave') {
      walking = true;
      const done = walkPath(a, dt);
      const sw = legsAndArms(u, true, a.phase);
      u.armR.rotation.x = a.cup.visible ? -0.3 : sw * 0.8; u.elbowR.rotation.x = a.cup.visible ? -1.4 : -0.2;
      a.status = a.state === 'toCoffee' ? 'Off to make himself a coffee' : 'Coffee in hand, looking for someone to talk to';
      if (done) { if (a.state === 'toCoffee') { a.state = 'brew'; a.t = 0; } else { a.state = 'go'; a.path = null; } }
    } else if (a.state === 'brew') {
      a.head = Math.PI;
      a.status = 'Making himself a coffee';
      u.legL.rotation.x = u.legR.rotation.x = 0;
      u.armR.rotation.x = -0.6; u.elbowR.rotation.x = -0.8;
      if (a.t > 5) { const P = officePoints(); a.cup.visible = true; a.state = 'leave'; a.t = 0; a.path = [P.back, P.inside, P.out]; }
    } else {
      // give up on anyone he cannot catch and try the next person
      if (a.t > 40) { pickNext(a, others); a.t = 0; a.path = null; }
      const tgt2 = others[a.ti % others.length];
      if (tgt2 !== tgt) return;
      const cs = chatSpot(tgt);
      a.rp = (a.rp || 0) + dt;
      const moved = !a.goal || Math.hypot(cs.x - a.goal.x, cs.z - a.goal.z) > 1.5;
      if (!a.path || (a.rp > 2 && moved)) { a.rp = 0; a.goal = cs; a.path = planTo(a, cs).concat([cs]); }
      // close enough: walk straight at the person
      if (Math.hypot(cs.x - a.x, cs.z - a.z) < (tgt.id === 'nasser' ? 3.5 : 9)) a.path = [cs];
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
      a.status = 'Heading over to chat with ' + (tgt.anon ? 'a warehouse worker' : tgt.name);
      const sw = Math.sin(a.phase) * 0.5;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.25;
    }
    a.mesh.position.set(a.x, walking ? Math.abs(Math.sin(a.phase)) * 0.03 : 0, a.z);
    turn(a.mesh, a.head, dt);
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

  // ---------- build ----------
  A.build = function (scene) {
    const off = B.zoneById('OFF'), cz = (off.z[0] + off.z[1]) / 2;
    const ex = 44.6, dspZ = 31.2, frontZ = -25.0;
    const people = [
      { id: 'mansour', name: 'Mansour', role: 'Material handler', watched: true, speed: 1.35, boxColor: '#c79a5b',
        about: 'Carries light cartons from the small parts store to the shipping lanes. First on the floor every shift.',
        look: { height: 1.93, girth: 0.8, skin: SKIN.dark, shirt: '#ff8a1f', vest: true, hat: 'helmet', label: 'Mansour' },
        route: [{ x: 49.5, z: -22, pick: true }, { x: ex, z: -22 }, { x: ex, z: dspZ }, { x: 20, z: dspZ, drop: true }, { x: ex, z: dspZ }, { x: ex, z: -22 }] },
      { id: 'mohsen', name: 'Mohsen', role: 'Material handler', watched: true, speed: 1.0, boxColor: '#b98a4e',
        about: 'Moves small cartons from receiving to the bin shelving. Has never dropped a box.',
        look: { height: 1.6, girth: 1.42, skin: SKIN.brown, shirt: '#ffb21f', vest: true, hat: 'helmet', label: 'Mohsen' },
        route: [{ x: -47, z: -31.2, pick: true }, { x: -47, z: frontZ }, { x: ex + 0.8, z: frontZ }, { x: ex + 0.8, z: -12 }, { x: 49.5, z: -12, drop: true }, { x: ex + 0.8, z: -12 }, { x: ex + 0.8, z: frontZ }, { x: -47, z: frontZ }] },
      { id: 'w1', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.2, boxColor: '#d4a86a', anon: true,
        about: 'Pushes a hand cart of light cartons from the small parts store to the shipping lanes.',
        look: { height: 1.74, girth: 1.0, skin: SKIN.tan, shirt: '#2a7fd4', pants: '#26303b', vest: true, hat: 'helmet', hatColor: '#ffffff' },
        route: [{ x: 49.5, z: -30, pick: true }, { x: ex - 0.8, z: -30 }, { x: ex - 0.8, z: dspZ + 0.8 }, { x: 4, z: dspZ + 0.8, drop: true }, { x: ex - 0.8, z: dspZ + 0.8 }, { x: ex - 0.8, z: -30 }] },
      { id: 'w2', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.25, boxColor: '#c08c50', anon: true,
        about: 'Carries inspected small parts from quality inspection back to receiving.',
        look: { height: 1.7, girth: 1.05, skin: SKIN.fair, shirt: '#3aa35b', vest: true, hat: 'helmet', hatColor: '#3a8bd8' },
        route: [{ x: -54, z: -19, pick: true }, { x: -54, z: frontZ }, { x: -38, z: frontZ }, { x: -38, z: -30.5, drop: true }, { x: -38, z: frontZ }, { x: -54, z: frontZ }] },
      { id: 'w3', name: 'Warehouse worker', role: 'Material handler', watched: true, speed: 1.15, boxColor: '#d9b27a', anon: true,
        about: 'Takes small cartons from the shelving to the shipping marshalling area.',
        look: { height: 1.8, girth: 0.95, skin: SKIN.brown, shirt: '#ff8a1f', vest: true, hat: 'helmet' },
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

    const abdullah = { id: 'abdullah', kind: 'person', name: 'Abdullah', role: 'Co-op student', x: -2, z: -30.6, homeX: -2, homeZ: -30.6, head: 0, t: 0, state: 'watch', speed: 1.3, phase: 0, path: null,
      about: 'Co-op student learning how the floor runs. Watches the team with a glass of tea and joins Nasser at the coffee machine.',
      mesh: makePerson({ height: 1.88, girth: 1.32, skin: SKIN.arab, shirt: '#ff8a1f', pants: '#26303b', vest: true, hat: 'helmet', hatColor: '#ffffff', label: 'Abdullah' }), update: updateWatcher, status: 'Watching the floor' };
    const tea = new T.Mesh(new T.CylinderGeometry(0.03, 0.025, 0.08, 12), new T.MeshStandardMaterial({ color: '#b5541f', transparent: true, opacity: 0.85, roughness: 0.1 }));
    tea.position.set(0, -0.33 * abdullah.mesh.userData.s, 0.07);
    tea.scale.setScalar(1.6);
    abdullah.mesh.userData.elbowR.add(tea);
    abdullah.mesh.position.set(abdullah.x, 0, abdullah.z);

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
    const nasser = { id: 'nasser', kind: 'person', name: 'Nasser', role: 'Inventory controller', x: seat.x, z: seat.z, head: Math.PI, t: 0, state: 'desk', speed: 0.9, phase: 0, seat, coffee,
      about: 'Runs the stock system from his computer and only leaves his desk to make coffee.',
      mesh: makePerson({ height: 1.62, girth: 1.0, skin: SKIN.fair, shirt: '#5a6b7d', pants: '#2b2f36', hat: 'cap', hatColor: '#14284b', label: 'Nasser' }), update: updateDesk, status: 'Working at his computer' };
    nasser.cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.1, 12), W.mat('#f2f2f2'));
    nasser.cup.position.set(0, -0.33 * nasser.mesh.userData.s, 0.06);
    nasser.cup.visible = false;
    nasser.mesh.userData.elbowR.add(nasser.cup);
    nasser.mesh.position.set(seat.x, 0, seat.z);

    const ghazi = { id: 'ghazi', kind: 'person', name: 'Ghazi', role: 'Always passing by', x: 10, z: -25.8, head: 0, t: 0, ti: -1, state: 'go', speed: 1.7, phase: 0, path: null,
      about: 'Drops by to chat with everyone on the floor, named or not. Has not lifted a carton yet.',
      mesh: makePerson({ height: 1.76, girth: 1.08, skin: SKIN.tan, shirt: '#2e8b57', pants: '#3a3f47', hat: 'helmet', hatColor: '#ffffff', label: 'Ghazi' }), update: updateChatter, status: 'Looking for someone to talk to' };
    ghazi.cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.1, 12), W.mat('#f2f2f2'));
    ghazi.cup.visible = false;
    ghazi.bubble = W.makeLabel('…', { size: 0.5, bg: 'rgba(255,255,255,0.95)', fg: '#1a1300', weight: 700 });
    ghazi.bubble.position.set(0.45, 2.75, 0);
    ghazi.bubble.visible = false;
    ghazi.mesh.add(ghazi.bubble);
    ghazi.cup.position.set(0, -0.33 * ghazi.mesh.userData.s, 0.06);
    ghazi.mesh.userData.elbowR.add(ghazi.cup);
    ghazi.mesh.position.set(ghazi.x, 0, ghazi.z);

    const chg = B.zoneById('CHG'), yz = B.zoneById('YARD');
    const d1 = { id: 'd1', kind: 'drone', name: 'Drone D1', role: 'Indoor inventory drone', indoor: true, padX: chg.x[1] + 2.5, padY: 0.12, padZ: chg.z[0] + 2.5, plan: [], scans: 0, battery: 92, t: 0, head: 0,
      about: 'Flies the rack aisles and reads pallet labels for cycle counts, without a person on a lift.', mission: null, mesh: makeDrone('#f2b31b'), status: 'Charging on the pad' };
    d1.mission = () => indoorMission(d1);
    const d2 = { id: 'd2', kind: 'drone', name: 'Drone D2', role: 'Yard survey drone', indoor: false, padX: yz.x[0] + 3, padY: 0.12, padZ: 0, plan: [], scans: 0, battery: 88, t: 0, head: 0,
      about: 'Surveys the open yard from 16 m and counts pipe bundles, drums and containers.', mission: null, mesh: makeDrone('#58d0ff'), status: 'Charging on the pad' };
    d2.mission = () => yardMission(d2);
    [d1, d2].forEach((d) => { d.x = d.padX; d.y = d.padY; d.z = d.padZ; d.mesh.scale.setScalar(d.indoor ? 1.3 : 2.2); pad(scene, d.padX, d.padZ); d.update = updateDrone; });
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
  A.update = function (dt) { A.list.forEach((a) => a.update(a, dt)); };
  A.y = (a) => (a.kind === 'drone' ? a.y : 1.2);
})();
