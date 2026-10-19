/* Building 100 - 3D scene construction */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = (B.world = { pickables: [], doorsIn: [], doorsOut: [], stageIn: [], stageOut: [] });
  const RACK = B.RACK;
  const BX0 = B.BUILDING.x0, BX1 = B.BUILDING.x1, BZ0 = B.BUILDING.z0, BZ1 = B.BUILDING.z1, BWd = BX1 - BX0, BDp = BZ1 - BZ0;

  const matCache = {};
  function mat(color, o) {
    const key = color + JSON.stringify(o || {});
    if (!matCache[key]) matCache[key] = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0.05 }, o || {}));
    return matCache[key];
  }
  W.mat = mat;
  function box(w, h, d, color, o) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, o));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  W.box = box;
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), C = new T.Color();
  function setInst(mesh, i, x, y, z, sx, sy, sz, rotY) {
    Q.setFromAxisAngle(new T.Vector3(0, 1, 0), rotY || 0);
    M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
    mesh.setMatrixAt(i, M4);
  }
  function inst(geo, material, count) {
    const m = new T.InstancedMesh(geo, material, count);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  function tag(obj, data) {
    obj.userData.pick = data;
    W.pickables.push(obj);
    return obj;
  }

  W.build = function (scene) {
    W.scene = scene;
    ground(scene);
    shell(scene);
    zones(scene);
    racks(scene);
    pallets(scene);
    pipeYard(scene);
    hazmat(scene);
    shelving(scene);
    qc(scene);
    office(scene);
    docks(scene);
    lanes(scene);
    highlight(scene);
    W.labels = new T.Group();
    scene.add(W.labels);
  };

  function ground(scene) {
    const sand = (W.sand = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshStandardMaterial({ color: '#cbb68e', roughness: 1 })));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.05;
    sand.receiveShadow = true;
    scene.add(sand);
    const asphalt = mat('#4b4f55', { roughness: 0.95 });
    [[-45, BZ0 - 25, 44, 50], [6, BZ1 + 25, 66, 50], [(BX1 + 76) / 2, 0, 76 - BX1, BDp + 20], [96, BZ1 + 5, 44, 10]].forEach(([x, z, w, d]) => {
      const p = new T.Mesh(new T.PlaneGeometry(w, d), asphalt);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, -0.03, z);
      p.receiveShadow = true;
      scene.add(p);
    });
    const floor = new T.Mesh(new T.PlaneGeometry(BWd, BDp), mat('#b8bdc2', { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  function shell(scene) {
    const g = (W.shell = new T.Group());
    const glass = new T.MeshStandardMaterial({ color: '#c9d3dc', transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide });
    const H = B.BUILDING.h;
    const walls = [[0, BZ0, BWd, 0.3], [0, BZ1, BWd, 0.3], [BX0, 0, 0.3, BDp], [BX1, 0, 0.3, BDp]];
    walls.forEach(([x, z, w, d]) => {
      const m = new T.Mesh(new T.BoxGeometry(w, H, d), glass);
      m.position.set(x, H / 2, z);
      g.add(m);
      const base = box(w + 0.02, 1.2, d + 0.1, '#9aa3ab');
      base.position.set(x, 0.6, z);
      g.add(base);
    });
    // Perimeter steel columns
    for (let k = 0; k <= 12; k++) {
      const x = BX0 + (BWd * k) / 12;
      [BZ0, BZ1].forEach((z) => { const c = box(0.45, H, 0.45, '#56616c'); c.position.set(x, H / 2, z); g.add(c); });
    }
    for (let k = 1; k < 8; k++) {
      const z = BZ0 + (BDp * k) / 8;
      [BX0, BX1].forEach((x) => { const c = box(0.45, H, 0.45, '#56616c'); c.position.set(x, H / 2, z); g.add(c); });
    }
    // Roof edge frame
    [[0, BZ0, BWd, 0.5], [0, BZ1, BWd, 0.5], [BX0, 0, 0.5, BDp], [BX1, 0, 0.5, BDp]].forEach(([x, z, w, d]) => {
      const e = box(w, 0.5, d, '#56616c');
      e.position.set(x, H, z);
      g.add(e);
    });
    scene.add(g);
  }

  function zones(scene) {
    W.zoneFloors = {};
    B.ZONES.forEach((zn) => {
      const w = zn.x[1] - zn.x[0], d = zn.z[1] - zn.z[0];
      const cx = (zn.x[0] + zn.x[1]) / 2, cz = (zn.z[0] + zn.z[1]) / 2;
      const p = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: zn.color, transparent: true, opacity: 0.16, depthWrite: false }));
      p.rotation.x = -Math.PI / 2;
      p.position.set(cx, 0.02, cz);
      scene.add(tag(p, { type: 'zone', id: zn.id }));
      W.zoneFloors[zn.id] = p;
      const pts = [[zn.x[0], zn.z[0]], [zn.x[1], zn.z[0]], [zn.x[1], zn.z[1]], [zn.x[0], zn.z[1]], [zn.x[0], zn.z[0]]].map(([x, z]) => new T.Vector3(x, 0.04, z));
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: zn.color }));
      scene.add(line);
    });
  }

  function racks(scene) {
    const H = RACK.levels * RACK.levelH + 0.25;
    const nUp = RACK.rows.length * (RACK.bays + 1) * 2;
    const up = inst(new T.BoxGeometry(0.1, H, 0.1), mat('#2b5c9c', { metalness: 0.3, roughness: 0.6 }), nUp);
    let i = 0;
    RACK.rows.forEach((row) => {
      for (let b = 0; b <= RACK.bays; b++) {
        const x = RACK.x0 + b * RACK.bayW;
        setInst(up, i++, x, H / 2, row.z - RACK.depth / 2, 1, 1, 1);
        setInst(up, i++, x, H / 2, row.z + RACK.depth / 2, 1, 1, 1);
      }
    });
    scene.add(up);
    const nBeam = RACK.rows.length * RACK.bays * RACK.levels * 2;
    const beam = inst(new T.BoxGeometry(RACK.bayW - 0.1, 0.13, 0.07), mat('#e07b24', { metalness: 0.2, roughness: 0.6 }), nBeam);
    i = 0;
    RACK.rows.forEach((row) => {
      for (let b = 0; b < RACK.bays; b++) {
        const x = RACK.x0 + b * RACK.bayW + RACK.bayW / 2;
        for (let l = 1; l <= RACK.levels; l++) {
          setInst(beam, i++, x, l * RACK.levelH, row.z - RACK.depth / 2, 1, 1, 1);
          setInst(beam, i++, x, l * RACK.levelH, row.z + RACK.depth / 2, 1, 1, 1);
        }
      }
    });
    scene.add(beam);
  }

  function pallets(scene) {
    const n = B.SLOTS.length;
    W.palletBase = inst(new T.BoxGeometry(1.1, 0.14, 1.0), mat('#a77b4f'), n);
    W.palletLoad = inst(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }), n);
    W.palletLoad.userData.pick = { type: 'slot' };
    W.pickables.push(W.palletLoad);
    B.SLOTS.forEach((s) => W.updateSlot(s));
    scene.add(W.palletBase, W.palletLoad);
  }

  W.heatmap = false;
  W.colorForSlot = function (s, out) {
    if (W.heatmap) {
      const t = Math.min(1, s.days / 365);
      return out.setHSL(0.36 * (1 - t), 0.62, 0.48);
    }
    return out.set(B.CATS[B.ITEMS[s.item].cat].color);
  };
  W.updateSlot = function (s, noFlag) {
    if (s.item < 0) {
      setInst(W.palletBase, s.i, s.x, -50, s.z, 0.001, 0.001, 0.001);
      setInst(W.palletLoad, s.i, s.x, -50, s.z, 0.001, 0.001, 0.001);
    } else {
      const h = B.ITEMS[s.item].h;
      setInst(W.palletBase, s.i, s.x, s.y + 0.07, s.z, 1, 1, 1);
      setInst(W.palletLoad, s.i, s.x, s.y + 0.14 + h / 2, s.z, 1, h, 0.95);
      W.palletLoad.setColorAt(s.i, W.colorForSlot(s, C));
    }
    if (!noFlag) W.flagPallets();
  };
  W.flagPallets = function () {
    W.palletBase.instanceMatrix.needsUpdate = true;
    W.palletLoad.instanceMatrix.needsUpdate = true;
    if (W.palletLoad.instanceColor) W.palletLoad.instanceColor.needsUpdate = true;
  };
  W.setHeatmap = function (on) {
    W.heatmap = on;
    B.SLOTS.forEach((s) => s.item >= 0 && W.palletLoad.setColorAt(s.i, W.colorForSlot(s, C)));
    W.flagPallets();
  };

  // Free-standing pallet (staging and transport)
  W.makePallet = function (itemIdx) {
    const it = B.ITEMS[itemIdx];
    const g = new T.Group();
    const base = box(1.1, 0.14, 1.0, '#a77b4f');
    base.position.y = 0.07;
    const load = box(1, it.h, 0.95, B.CATS[it.cat].color);
    load.position.y = 0.14 + it.h / 2;
    g.add(base, load);
    return g;
  };

  function pipeYard(scene) {
    const g = new T.Group();
    const xs = [-62, -54, -46];
    const levels = [0.6, 2.0, 3.4];
    const n = xs.length * 2 * levels.length * 2 * 6;
    const pipes = inst(new T.CylinderGeometry(1, 1, 12, 14), mat('#6d5a48', { metalness: 0.4, roughness: 0.55 }), n);
    let i = 0;
    xs.forEach((x, ri) => {
      for (let z = -6; z <= 34; z += 4) {
        const c = box(0.35, 4.4, 0.35, '#2b5c9c');
        c.position.set(x, 2.2, z);
        g.add(c);
        levels.forEach((y) => { const arm = box(3.6, 0.14, 0.18, '#e07b24'); arm.position.set(x, y - 0.1, z); g.add(arm); });
      }
      const r = [0.16, 0.22, 0.32][ri];
      [-1, 1].forEach((side) => levels.forEach((y) => [3, 22].forEach((zc) => {
        for (let k = 0; k < 6; k++) {
          const px = x + side * (0.5 + (k % 3) * r * 2.1), py = y + r + Math.floor(k / 3) * r * 1.9;
          Q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
          M4.compose(V.set(px, py, zc), Q, S.set(r, 1, r));
          pipes.setMatrixAt(i++, M4);
        }
      })));
    });
    g.add(tag(pipes, { type: 'zone', id: 'PIPE' }));
    scene.add(g);
  }

  function hazmat(scene) {
    const zn = B.zoneById('HAZ');
    const g = new T.Group();
    const fence = new T.MeshStandardMaterial({ color: '#c0392b', transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false });
    const edges = [[zn.x[0], zn.z[0], zn.x[1], zn.z[0]], [zn.x[1], zn.z[0], zn.x[1], zn.z[1]], [zn.x[0], zn.z[1], zn.x[1], zn.z[1]], [zn.x[0], zn.z[0], zn.x[0], (zn.z[0] + zn.z[1]) / 2 - 2], [zn.x[0], (zn.z[0] + zn.z[1]) / 2 + 2, zn.x[0], zn.z[1]]];
    edges.forEach(([x1, z1, x2, z2]) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const p = new T.Mesh(new T.PlaneGeometry(len, 2.6), fence);
      p.position.set((x1 + x2) / 2, 1.3, (z1 + z2) / 2);
      p.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      g.add(p);
      const steps = Math.ceil(len / 2.5);
      for (let k = 0; k <= steps; k++) {
        const post = box(0.08, 2.7, 0.08, '#7b241c');
        post.position.set(x1 + ((x2 - x1) * k) / steps, 1.35, z1 + ((z2 - z1) * k) / steps);
        g.add(post);
      }
    });
    const drumColors = ['#2e6fbf', '#d9a400', '#3c8d4f', '#8e2b20'];
    const drums = inst(new T.CylinderGeometry(0.29, 0.29, 0.88, 16), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.3 }), 96);
    let i = 0;
    for (let r = 0; r < 4; r++) {
      for (let p = 0; p < 6; p++) {
        const cx = zn.x[0] + 3.5 + r * 4.2, cz = zn.z[0] + 3.5 + p * 1.9;
        const spill = box(1.3, 0.3, 1.3, '#d4a60d');
        spill.position.set(cx, 0.15, cz);
        g.add(spill);
        for (let k = 0; k < 4; k++) {
          setInst(drums, i, cx + (k % 2 ? 0.3 : -0.3), 0.74, cz + (k < 2 ? 0.3 : -0.3), 1, 1, 1);
          drums.setColorAt(i++, C.set(drumColors[r]));
        }
      }
    }
    g.add(tag(drums, { type: 'zone', id: 'HAZ' }));
    const cyl = inst(new T.CylinderGeometry(0.12, 0.12, 1.5, 10), mat('#5d8a5e', { metalness: 0.4 }), 24);
    for (let k = 0; k < 24; k++) setInst(cyl, k, zn.x[0] + 4 + (k % 12) * 0.4, 0.75, zn.z[1] - 4 + Math.floor(k / 12) * 0.5, 1, 1, 1);
    g.add(tag(cyl, { type: 'zone', id: 'HAZ' }));
    const chain = box(5, 0.05, 0.05, '#333333');
    chain.position.set(zn.x[0] + 6.2, 1.1, zn.z[1] - 3.75);
    g.add(chain);
    scene.add(g);
  }

  function shelving(scene) {
    const g = new T.Group();
    const sz = B.zoneById('SHELF');
    const xs = [0, 1, 2, 3, 4, 5].map((k) => sz.x[0] + 2 + k * 3.4);
    const shelvesY = [0.15, 0.65, 1.15, 1.65, 2.15];
    const perShelf = 46, zc = (sz.z[0] + sz.z[1]) / 2, len = perShelf * 0.6;
    const bins = inst(new T.BoxGeometry(0.45, 0.28, 0.5), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), xs.length * shelvesY.length * perShelf);
    const binColors = ['#2d6fb8', '#2d6fb8', '#d64541', '#4a5560', '#2d6fb8', '#e2a400'];
    let i = 0;
    xs.forEach((x, u) => {
      shelvesY.forEach((y) => {
        const s = box(0.6, 0.04, len + 0.4, '#9aa4ae', { metalness: 0.4 });
        s.position.set(x, y, zc);
        g.add(s);
        for (let k = 0; k < perShelf; k++) {
          setInst(bins, i, x, y + 0.16, zc - len / 2 + 0.3 + k * 0.6, 1, 1, 1);
          bins.setColorAt(i++, C.set(binColors[(u + k) % 6]));
        }
      });
      [zc - len / 2, zc, zc + len / 2].forEach((z) => [-0.28, 0.28].forEach((dx) => { const p = box(0.05, 2.6, 0.05, '#6f7b86'); p.position.set(x + dx, 1.3, z); g.add(p); }));
    });
    g.add(tag(bins, { type: 'zone', id: 'SHELF' }));
    scene.add(g);
  }

  function qc(scene) {
    const g = new T.Group();
    [[-63, -21], [-63, -16.5]].forEach(([x, z]) => {
      const t = box(2.4, 0.9, 1.2, '#7f8c99', { metalness: 0.3 });
      t.position.set(x, 0.45, z);
      g.add(tag(t, { type: 'zone', id: 'QC' }));
    });
    const holds = ['#3c8d4f', '#d64541', '#3c8d4f', '#d9a400', '#3c8d4f', '#d64541', '#3c8d4f', '#3c8d4f'];
    holds.forEach((c, k) => {
      const p = W.makePallet(B.itemsByCat[['valve', 'elec', 'inst', 'mech'][k % 4]][k % 3]);
      p.position.set(-58 + (k % 4) * 2.6, 0, -21 + Math.floor(k / 4) * 5);
      const tagM = box(0.4, 0.3, 0.05, c, { emissive: c, emissiveIntensity: 0.4 });
      tagM.position.set(0, 0.9, 0.52);
      p.add(tagM);
      p.traverse((o) => (o.userData.pick = { type: 'zone', id: 'QC' }));
      W.pickables.push(p);
      g.add(p);
    });
    scene.add(g);
  }

  function office(scene) {
    const zn = B.zoneById('OFF');
    const g = new T.Group();
    const w = zn.x[1] - zn.x[0], d = zn.z[1] - zn.z[0], cx = (zn.x[0] + zn.x[1]) / 2, cz = (zn.z[0] + zn.z[1]) / 2;
    const walls = new T.Mesh(new T.BoxGeometry(w, 3.2, d), new T.MeshStandardMaterial({ color: '#8fb3cf', transparent: true, opacity: 0.45, roughness: 0.2 }));
    walls.position.set(cx, 1.6, cz);
    const roof = box(w + 0.3, 0.25, d + 0.3, '#e4e8ec');
    roof.position.set(cx, 3.3, cz);
    g.add(tag(walls, { type: 'zone', id: 'OFF' }), roof);
    for (let k = 0; k < 4; k++) { const desk = box(1.6, 0.75, 0.8, '#6b4f3a'); desk.position.set(zn.x[0] + 2 + k * 3.2, 0.38, cz + 1.5); g.add(desk); }
    scene.add(g);
    const chg = B.zoneById('CHG');
    for (let k = 0; k < 6; k++) {
      const c = box(0.8, 1.6, 0.5, '#3f8f4f');
      c.position.set(chg.x[0] + 1 + k * 2.2, 0.8, chg.z[0] + 0.4);
      scene.add(tag(c, { type: 'zone', id: 'CHG' }));
      const led = box(0.3, 0.1, 0.02, '#7dff9a', { emissive: '#3cff6a', emissiveIntensity: 1 });
      led.position.set(chg.x[0] + 1 + k * 2.2, 1.3, chg.z[0] + 0.66);
      scene.add(led);
    }
  }

  function docks(scene) {
    const make = (x, z, dir, list, idx) => {
      const door = box(3.6, 4.2, 0.15, '#4a5560', { metalness: 0.5, roughness: 0.4 });
      door.position.set(x, 2.1, z + dir * 0.1);
      scene.add(door);
      const pad = box(4.2, 0.2, 2.5, '#2c3238');
      pad.position.set(x, 0.1, z - dir * 1.25);
      scene.add(pad);
      const lev = box(2.4, 0.06, 2.2, '#c49a2c', { metalness: 0.5 });
      lev.position.set(x, 0.03, z + dir * 1.3);
      scene.add(lev);
      const lamp = box(0.25, 0.25, 0.1, '#3cff6a', { emissive: '#3cff6a', emissiveIntensity: 0.8 });
      lamp.position.set(x + 2.3, 4.6, z + dir * 0.2);
      scene.add(lamp);
      list.push({ x, z, dir, busy: false, n: idx + 1, lamp });
    };
    [-60, -51, -42, -33].forEach((x, k) => make(x, BZ0, 1, W.doorsIn, k));
    [-16, -2, 12, 26].forEach((x, k) => make(x, BZ1, -1, W.doorsOut, k));
    // One row of 6 staging spots per door so a forklift can reach every pallet directly
    W.doorsIn.forEach((d) => { for (let j = 0; j < 6; j++) W.stageIn.push({ x: d.x - 3.25 + j * 1.3, z: BZ0 + 7.8, door: d, used: null }); });
    W.doorsOut.forEach((d) => { for (let j = 0; j < 6; j++) W.stageOut.push({ x: d.x - 3.25 + j * 1.3, z: BZ1 - 6.4, door: d, used: null }); });
  }
  W.setDoorLamp = function (d, busy) {
    d.busy = busy;
    const c = busy ? '#ff5a3c' : '#3cff6a';
    d.lamp.material = mat(c, { emissive: c, emissiveIntensity: 0.9 });
  };

  function lanes(scene) {
    const L = B.LANES;
    const g = (W.laneGroup = new T.Group());
    const yellow = new T.MeshBasicMaterial({ color: '#e8b100' });
    const stripe = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const p = new T.Mesh(new T.PlaneGeometry(len, 0.14), yellow);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
      p.position.set((x1 + x2) / 2, 0.035, (z1 + z2) / 2);
      g.add(p);
    };
    const w = 1.7;
    stripe(L.west - w, L.front, L.west - w, L.back); stripe(L.west + w, L.front + w, L.west + w, L.back - w);
    stripe(L.east - w, L.front + w, L.east - w, L.back - w); stripe(L.east + w, L.front, L.east + w, L.back);
    stripe(-64, L.front - w, L.east + w, L.front - w); stripe(-64, L.front + w, L.west - w, L.front + w); stripe(L.west + w, L.front + w, L.east - w, L.front + w);
    stripe(L.west - w, L.back + w, L.east + w, L.back + w); stripe(L.west + w, L.back - w, L.east - w, L.back - w);
    // Direction arrows on the west lane
    for (let z = -20; z <= 24; z += 9) {
      const a = new T.Mesh(new T.CircleGeometry(0.6, 3), yellow);
      a.rotation.x = -Math.PI / 2;
      a.position.set(L.west, 0.036, z);
      g.add(a);
    }
    scene.add(g);
  }

  function highlight(scene) {
    const g = (W.hl = new T.Group());
    const accent = '#f2b31b';
    W.hlBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.35, 1.6, 1.2)), new T.LineBasicMaterial({ color: accent }));
    W.hlBeam = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 24, 12, 1, true), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, depthWrite: false }));
    W.hlRing = new T.Mesh(new T.RingGeometry(1.2, 1.5, 40), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.8, side: T.DoubleSide }));
    W.hlRing.rotation.x = -Math.PI / 2;
    // Glow drawn on top of everything so the selection stays visible behind racks
    W.hlGlow = new T.Mesh(new T.BoxGeometry(1.35, 1.6, 1.2), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, depthTest: false }));
    W.hlGlow.renderOrder = 20;
    g.add(W.hlBox, W.hlBeam, W.hlRing, W.hlGlow);
    g.visible = false;
    scene.add(g);
  }
  W.highlightAt = function (x, y, z, h, w, d) {
    W.hl.visible = true;
    W.hlBox.position.set(x, y + h / 2, z);
    W.hlBox.scale.set((w || 1.35) / 1.35, h / 1.6, (d || 1.2) / 1.2);
    W.hlGlow.visible = !w;
    W.hlGlow.position.copy(W.hlBox.position);
    W.hlGlow.scale.copy(W.hlBox.scale);
    W.hlBeam.position.set(x, y + h + 12, z);
    W.hlRing.position.set(x, 0.06, z);
  };
  W.clearHighlight = () => (W.hl.visible = false);

  // Text labels
  W.makeLabel = function (text, o) {
    o = o || {};
    const px = o.px || 44;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = (o.weight || 600) + ' ' + px + 'px "Archivo", "IBM Plex Sans", "Segoe UI", sans-serif';
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    const pad = px * 0.55;
    c.width = tw + pad * 2;
    c.height = px * 1.7;
    ctx.font = font;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = o.bg || 'rgba(16,22,29,0.82)';
    const r = c.height / 2.4;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(c.width - r, 0); ctx.quadraticCurveTo(c.width, 0, c.width, r);
    ctx.lineTo(c.width, c.height - r); ctx.quadraticCurveTo(c.width, c.height, c.width - r, c.height);
    ctx.lineTo(r, c.height); ctx.quadraticCurveTo(0, c.height, 0, c.height - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.fill();
    if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(pad * 0.27, c.height * 0.25, pad * 0.18, c.height * 0.5); }
    ctx.fillStyle = o.fg || '#ffffff';
    ctx.fillText(text, c.width / 2, c.height / 2 + px * 0.04);
    const tex = new T.CanvasTexture(c);
    tex.anisotropy = 4;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: !!o.depthTest, transparent: true }));
    const hgt = o.size || 1.6;
    sp.scale.set((hgt * c.width) / c.height, hgt, 1);
    sp.renderOrder = o.depthTest ? 0 : 10;
    return sp;
  };

  W.buildLabels = function () {
    const tr = B.tr || ((t) => t);
    while (W.labels.children.length) W.labels.remove(W.labels.children[0]);
    B.ZONES.forEach((zn) => {
      const l = W.makeLabel(tr(zn.name), { stripe: zn.color, size: zn.id === 'RACK' || zn.id === 'YARD' ? 2.4 : 1.8 });
      l.position.set((zn.x[0] + zn.x[1]) / 2, zn.labelY, (zn.z[0] + zn.z[1]) / 2);
      W.labels.add(l);
    });
    RACK.rows.forEach((row) => {
      [RACK.x0 - 1, RACK.x0 + RACK.bays * RACK.bayW + 1].forEach((x) => {
        const l = W.makeLabel(row.letter, { size: 1.1, bg: '#f2b31b', fg: '#1a1300', weight: 700, depthTest: true });
        l.position.set(x, 9.6, row.z);
        W.labels.add(l);
      });
    });
    W.doorsIn.concat(W.doorsOut).forEach((d, k) => {
      const l = W.makeLabel(tr(k < 4 ? 'IN' : 'OUT') + ' ' + d.n, { size: 0.9, depthTest: true });
      l.position.set(d.x, 5.4, d.z + d.dir * 0.4);
      W.labels.add(l);
    });
    const name = W.makeLabel(tr('BUILDING 100 · MATERIALS WAREHOUSE'), { size: 3.2, bg: 'rgba(242,179,27,0.95)', fg: '#1a1300', weight: 700 });
    name.position.set(-22, 15, BZ0);
    W.labels.add(name);
  };
})();
