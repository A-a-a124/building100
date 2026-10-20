/* Building 100 - performance: merge static parts into a few draw calls, trim small shadow casters, adapt resolution to the device */
(function () {
  const B = window.B100, W = B.world, S = B.sim, T = THREE;
  const { renderer, scene, stage } = B.three;
  const CAPTURE = /[?&]capture/.test(location.search);

  // ---------- small things do not need to cast shadows ----------
  [W.palletBase, W.palletLoad, W.cylinders].forEach((m) => m && (m.castShadow = false));
  scene.traverse((o) => { if (o.isInstancedMesh && (o.count === 96 || (o.count > 1000 && o !== W.palletBase && o !== W.palletLoad))) o.castShadow = false; });
  const box = new T.Box3(), size = new T.Vector3();

  // ---------- merge static meshes that share a parent and a material ----------
  const skip = new Set();
  const addTree = (o) => o && o.traverse((c) => skip.add(c));
  S.forklifts.forEach((f) => addTree(f.mesh));
  S.trucks.forEach((t) => addTree(t.mesh));
  B.actors.list.forEach((a) => addTree(a.mesh));
  [W.hl, W.labels, B.hazmat.cabinet, B.hazmat.warn].forEach(addTree);
  B.hazmat.spills.forEach((m) => skip.add(m));
  W.doorsIn.concat(W.doorsOut).forEach((d) => skip.add(d.lamp));
  [W.sand, W.floor].forEach((m) => skip.add(m));

  scene.updateMatrixWorld(true);
  const buckets = new Map();
  scene.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || skip.has(m) || !m.visible || m.children.length) return;
    const mat = m.material, g = m.geometry;
    if (Array.isArray(mat) || mat.transparent || mat.isShaderMaterial || !g.attributes.normal || !g.attributes.uv || g.morphAttributes.position) return;
    if (m.castShadow) { box.setFromObject(m).getSize(size); if (Math.max(size.x, size.y, size.z) < 1) m.castShadow = false; }
    const pick = m.userData.pick ? JSON.stringify(m.userData.pick) : '';
    const key = m.parent.uuid + '|' + mat.uuid + '|' + m.castShadow + m.receiveShadow + '|' + pick + '|' + m.renderOrder;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });

  const inv = new T.Matrix4(), rel = new T.Matrix4(), nm = new T.Matrix3(), v = new T.Vector3();
  let before = 0, after = 0;
  buckets.forEach((list) => {
    before += list.length;
    if (list.length < 2) { after++; return; }
    const parent = list[0].parent;
    inv.copy(parent.matrixWorld).invert();
    let nv = 0, ni = 0;
    list.forEach((m) => { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let ov = 0, oi = 0;
    list.forEach((m) => {
      const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      rel.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(rel);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(rel); pos.set([v.x, v.y, v.z], (ov + i) * 3);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (ov + i) * 3);
        uv[(ov + i) * 2] = u.getX(i); uv[(ov + i) * 2 + 1] = u.getY(i);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.getX(i) + ov;
      else for (let i = 0; i < p.count; i++) idx[oi++] = i + ov;
      ov += p.count;
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(new T.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const merged = new T.Mesh(geo, list[0].material);
    Object.assign(merged, { castShadow: list[0].castShadow, receiveShadow: list[0].receiveShadow, renderOrder: list[0].renderOrder });
    if (list[0].userData.pick) merged.userData.pick = list[0].userData.pick;
    let wasPickable = false;
    list.forEach((m) => {
      const k = W.pickables.indexOf(m);
      if (k >= 0) { W.pickables.splice(k, 1); wasPickable = true; }
      parent.remove(m);
    });
    parent.add(merged);
    if (wasPickable) W.pickables.push(merged);
    after++;
  });
  B.perf = { merged: { before, after } };

  // ---------- adaptive resolution: step down when frames are slow, back up when there is headroom ----------
  const dpr = Math.min(devicePixelRatio || 1, 2);
  // last step keeps full resolution but turns shadows off, which costs the GPU the most
  const LEVELS = [dpr, Math.min(dpr, 1.5), Math.min(dpr, 1.25), 1].filter((q, i, a) => i === 0 || q < a[i - 1]);
  const MAX = LEVELS.length;
  let level = 0, frames = 0, acc = 0, cooldown = 3, goodFor = 0, shadows = true;
  const lowBox = () => document.getElementById('lyLow');
  function apply() {
    renderer.setPixelRatio(LEVELS[Math.min(level, MAX - 1)]);
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    const want = level < MAX;
    if (want !== shadows) {
      shadows = want; renderer.shadowMap.enabled = want; B.three.sun.castShadow = want;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    }
  }
  if (!CAPTURE && !(lowBox() && lowBox().checked)) apply();
  // the manual low-quality switch takes over; switching it off starts again from full quality
  if (lowBox()) lowBox().addEventListener('change', (e) => { if (!e.target.checked) { level = 0; shadows = true; cooldown = 3; } });
  B.hooks.frame.push((dt) => {
    if (CAPTURE || document.hidden || (lowBox() && lowBox().checked)) return;
    frames++; acc += dt;
    if (acc < 1.5) return;
    const fps = frames / acc; frames = 0; acc = 0;
    if ((cooldown -= 1.5) > 0) return;
    if (fps < 45 && level < MAX) { level++; apply(); cooldown = 3; goodFor = 0; }
    else if (fps > 57 && level > 0) { if ((goodFor += 1.5) >= 12) { level--; apply(); cooldown = 6; goodFor = 0; } }
    else goodFor = 0;
    B.perf.fps = Math.round(fps); B.perf.level = level;
  });
})();
