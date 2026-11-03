/* Building 19 - varied loads: wooden crates, drums and cable reels on the pallets by material type, cartons in cardboard, deeper shading low in the racks */
(function () {
  const B = window.B100, W = B.world, T = THREE;
  const { renderer, scene } = B.three;
  const R = B.rng(1414);
  const aniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  const N = B.SLOTS.length;

  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = aniso; return t;
  }
  // geometry parts [geometry, matrix, colour] merged into one, with vertex colours
  function merge(parts) {
    let nv = 0, ni = 0;
    parts.forEach(([g]) => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    const v = new T.Vector3(), nm = new T.Matrix3(), c = new T.Color();
    parts.forEach(([g, m, color]) => {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      nm.getNormalMatrix(m); c.set(color || '#ffffff');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos[(ov + i) * 3] = v.x; pos[(ov + i) * 3 + 1] = v.y; pos[(ov + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor[(ov + i) * 3] = v.x; nor[(ov + i) * 3 + 1] = v.y; nor[(ov + i) * 3 + 2] = v.z;
        uv[(ov + i) * 2] = u ? u.getX(i) : 0; uv[(ov + i) * 2 + 1] = u ? u.getY(i) : 0;
        col[(ov + i) * 3] = c.r; col[(ov + i) * 3 + 1] = c.g; col[(ov + i) * 3 + 2] = c.b;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.getX(i) + ov;
      else for (let i = 0; i < p.count; i++) idx[oi++] = i + ov;
      ov += p.count;
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setIndex(new T.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }
  const mt = (x, y, z, sx, sy, sz, rx, rz) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, 0, rz || 0)), new T.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));

  // ---------- surfaces ----------
  const crateMap = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#b98d58'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 7; k++) {
      const y = (k * h) / 7, t = 0.82 + R() * 0.3;
      g.fillStyle = 'rgb(' + Math.round(185 * t) + ',' + Math.round(141 * t) + ',' + Math.round(88 * t) + ')'; g.fillRect(0, y, w, h / 7);
      for (let q = 0; q < 40; q++) { g.strokeStyle = 'rgba(70,40,15,' + (0.04 + R() * 0.12) + ')'; g.lineWidth = 1; g.beginPath(); const yy = y + R() * (h / 7); g.moveTo(R() * w, yy); g.lineTo(R() * w, yy + R() * 3 - 1.5); g.stroke(); }
      g.fillStyle = 'rgba(30,18,8,0.75)'; g.fillRect(0, y, w, 3);
    }
    g.fillStyle = '#a97c49'; g.fillRect(0, 0, 44, h); g.fillRect(w - 44, 0, 44, h); g.fillRect(0, 0, w, 44); g.fillRect(0, h - 44, w, 44);
    g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = 3; g.strokeRect(44, 44, w - 88, h - 88);
    g.fillStyle = 'rgba(30,20,10,0.85)'; [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(25,25,28,0.8)'; g.font = '700 34px sans-serif'; g.textAlign = 'center'; g.fillText('THIS SIDE UP', w / 2, h / 2 - 8);
    g.font = '700 22px monospace'; g.fillText('HANDLE WITH CARE', w / 2, h / 2 + 26);
  });
  const drumMap = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    [0.02, 0.33, 0.66, 0.97].forEach((k) => { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, k * h - 3, w, 4); g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(0, k * h + 1, w, 3); });
    for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(0,0,0,' + R() * 0.05 + ')'; g.fillRect(R() * w, R() * h, 2 + R() * 6, 1 + R() * 2); }
    g.fillStyle = '#ffffff'; g.fillRect(w * 0.08, h * 0.42, w * 0.2, h * 0.17); g.fillStyle = '#20252a'; for (let k = 0; k < 7; k++) g.fillRect(w * 0.1 + k * 6, h * 0.45, 2, h * 0.11);
  });
  const reelMap = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(0,0,0,' + (0.18 + R() * 0.2) + ')'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, y + 3, w, 1); }
  });
  const crateMat = new T.MeshStandardMaterial({ map: crateMap, roughness: 0.82, metalness: 0, vertexColors: true });
  const drumMat = new T.MeshStandardMaterial({ map: drumMap, roughness: 0.38, metalness: 0.55, vertexColors: true });
  const reelMat = new T.MeshStandardMaterial({ map: reelMap, roughness: 0.7, metalness: 0.05, vertexColors: true });

  // ---------- load shapes, one unit high and centred ----------
  const cube = new T.BoxGeometry(1, 1, 1);
  const crateGeo = merge([[cube, new T.Matrix4(), '#ffffff'],
    [cube, mt(0, 0.47, 0, 1.03, 0.07, 1.03), '#b38654'], [cube, mt(0, -0.47, 0, 1.03, 0.07, 1.03), '#b38654'],
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [cube, mt(a * 0.495, 0, b * 0.495, 0.07, 1, 0.07), '#a97c49'])]);
  const can = new T.CylinderGeometry(0.24, 0.24, 1, 10);
  const drumGeo = merge([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [can, mt(a * 0.26, 0, b * 0.25), '#ffffff']));
  const flange = new T.CylinderGeometry(0.5, 0.5, 0.07, 14);
  const barrel = new T.CylinderGeometry(0.4, 0.4, 0.74, 14, 1, true);
  const reelGeo = merge([[barrel, mt(0, 0, 0, 1, 1, 1, 0, Math.PI / 2), '#2a2d31'],
    [flange, mt(-0.4, 0, 0, 1, 1, 1, 0, Math.PI / 2), '#b68a56'], [flange, mt(0.4, 0, 0, 1, 1, 1, 0, Math.PI / 2), '#b68a56']]);

  function pool(geo, mat) {
    const mesh = new T.InstancedMesh(geo, mat, N);
    mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.pick = { type: 'slot' }; mesh.userData.slotOf = new Int32Array(N);
    W.pickables.push(mesh); scene.add(mesh);
    return mesh;
  }
  const POOLS = { crate: pool(crateGeo, crateMat), drum: pool(drumGeo, drumMat), reel: pool(reelGeo, reelMat) };
  const DRUMS = ['#245fa8', '#1f2428', '#a9281e', '#2f7d46', '#c9a01f'];

  // the shape follows the material name, then its category
  const typeCache = new WeakMap();
  function typeOf(it) {
    if (typeCache.has(it)) return typeCache.get(it);
    const n = (it.name + ' ' + (it.spec || '')).toLowerCase();
    let t = 'carton';
    if (/cable|wire rope/.test(n) && !/gland|tie|lug/.test(n)) t = 'reel';
    else if (it.cat === 'cons' || /\b(oil|lube|grease|solvent|paint|coolant|chemical|additive)\b/.test(n)) t = 'drum';
    else if (it.cat === 'valve' || it.cat === 'flange' || it.cat === 'mech' || /pump|motor|gearbox|breaker|switchgear|transformer/.test(n)) t = 'crate';
    typeCache.set(it, t);
    return t;
  }

  // ---------- colours: the category stays readable, but cartons read as cardboard and low levels sit in shade ----------
  const card = new T.Color('#d4b184'), wood = new T.Color('#e2c8a2'), tmp = new T.Color();
  const base = W.colorForSlot;
  W.colorForSlot = function (s, out) {
    base(s, out);
    if (W.heatmap || (B.stock && B.stock.mode())) return out;
    const it = B.ITEMS[s.item]; if (!it) return out;
    const t = typeOf(it);
    if (t === 'carton') out.lerp(card, 0.42);
    else if (t === 'crate') { tmp.copy(out); out.copy(wood).lerp(tmp, 0.2); }
    else if (t === 'reel') out.lerp(wood, 0.8);
    else out.set(DRUMS[it.i % DRUMS.length]);
    return out.multiplyScalar(0.74 + 0.26 * Math.min(1, (s.level || 0) / 3) + ((s.i * 7919) % 11) * 0.006);
  };

  // ---------- keep each slot's instance in the pool of its shape ----------
  const kind = new Array(N).fill(null), where = new Int32Array(N).fill(-1);
  const M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), SC = new T.Vector3(), C = new T.Color();
  let dirty = false;
  function drop(i) {
    const k = kind[i]; if (!k) return;
    const m = POOLS[k], at = where[i], last = m.count - 1, map = m.userData.slotOf;
    if (at !== last) {
      m.getMatrixAt(last, M); m.setMatrixAt(at, M);
      if (m.instanceColor) { m.getColorAt(last, C); m.setColorAt(at, C); }
      map[at] = map[last]; where[map[at]] = at;
    }
    m.count = last; kind[i] = null; where[i] = -1; dirty = true;
  }
  const update = W.updateSlot, setColor = W.palletLoad.setColorAt.bind(W.palletLoad);
  W.palletLoad.setColorAt = function (i, c) {
    setColor(i, c);
    if (kind[i]) { POOLS[kind[i]].setColorAt(where[i], c); dirty = true; }
  };
  W.updateSlot = function (s, noFlag) {
    update(s, true);
    const it = s.item >= 0 ? B.ITEMS[s.item] : null, t = it ? typeOf(it) : 'carton';
    if (t === 'carton') drop(s.i);
    else {
      if (kind[s.i] !== t) { drop(s.i); const m = POOLS[t]; kind[s.i] = t; where[s.i] = m.count; m.userData.slotOf[m.count] = s.i; m.count++; }
      const m = POOLS[t], h = it.h, y = s.y + 0.14 + h / 2;
      Q.setFromAxisAngle(P.set(0, 1, 0), t === 'reel' ? ((s.i * 13) % 3) * 0.05 : 0);
      if (t === 'reel') M.compose(P.set(s.x, s.y + 0.14 + h * 0.5, s.z), Q, SC.set(h, h, h));
      else M.compose(P.set(s.x, y, s.z), Q, SC.set(t === 'crate' ? 1 : 1, h, 0.95));
      m.setMatrixAt(where[s.i], M);
      m.setColorAt(where[s.i], W.colorForSlot(s, C));
      M.compose(P.set(s.x, -50, s.z), Q.identity(), SC.set(0.001, 0.001, 0.001));
      W.palletLoad.setMatrixAt(s.i, M);
      dirty = true;
    }
    if (!noFlag) W.flagPallets();
  };
  const flag = W.flagPallets;
  W.flagPallets = function () {
    flag();
    Object.values(POOLS).forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    dirty = false;
  };
  B.SLOTS.forEach((s) => W.updateSlot(s, true));
  B.SLOTS.forEach((s) => s.item >= 0 && W.palletLoad.setColorAt(s.i, W.colorForSlot(s, C)));
  W.flagPallets();
  // some modules recolour by writing straight to the carton mesh: catch up once a frame
  B.hooks.frame.push(() => { if (dirty) W.flagPallets(); });

  // ---------- free-standing pallets (staging lanes and on the forks) get the same shapes ----------
  const palletGeo = new T.BoxGeometry(1.1, 0.14, 1.0);
  const palletMat = W.palletBase.material;
  const matCache = {};
  function tintedMat(src, key, color) {
    const k = src.uuid + key;
    if (!matCache[k]) { matCache[k] = src.clone(); matCache[k].color.set(color); }
    return matCache[k];
  }
  const cartonMat = W.palletLoad.material;
  W.makePallet = function (itemIdx) {
    const it = B.ITEMS[itemIdx], g = new T.Group(), t = typeOf(it);
    const baseM = new T.Mesh(palletGeo, palletMat); baseM.position.y = 0.07; baseM.castShadow = true; baseM.receiveShadow = true; g.add(baseM);
    const cat = B.CATS[it.cat].color;
    let load;
    if (t === 'carton') { load = new T.Mesh(cube, tintedMat(cartonMat, cat, C.set(cat).lerp(card, 0.42).getStyle())); load.scale.set(1, it.h, 0.95); }
    else if (t === 'crate') { load = new T.Mesh(crateGeo, crateMat); load.scale.set(1, it.h, 0.95); }
    else if (t === 'drum') { load = new T.Mesh(drumGeo, tintedMat(drumMat, it.i % DRUMS.length, DRUMS[it.i % DRUMS.length])); load.scale.set(1, it.h, 0.95); }
    else { load = new T.Mesh(reelGeo, reelMat); load.scale.setScalar(it.h); }
    load.position.y = 0.14 + it.h / 2; load.castShadow = true; load.receiveShadow = true;
    g.add(load);
    return g;
  };

  B.colourModes = B.colourModes || {};
  B.colourModes.cat = (s, out) => out.set(B.CATS[B.ITEMS[s.item].cat].color);
  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyCat">Colour pallets by category</label>');
  document.getElementById('lyCat').addEventListener('change', (e) => B.stock.setColourMode(e.target.checked ? 'cat' : ''));

  B.loads = { typeOf, merge, mt, canvas, materials: [crateMat, drumMat, reelMat], count: () => Object.values(POOLS).reduce((n, m) => n + m.count, 0), pools: POOLS };
})();
