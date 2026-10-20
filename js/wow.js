/* Building 100 - visual polish: opening fly-in, the plant on the horizon with a burning flare, lamp light at night, forklift blue safety spots */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const { scene, hemi, camera, controls } = B.three;
  const CAPTURE = /[?&]capture/.test(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = B.rng(808);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3();
  const baseHemi = hemi.intensity;
  const night = () => 1 - Math.max(0, Math.min(1, (hemi.intensity / baseHemi - 0.3) / 0.7));
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();

  // ---------- the plant on the horizon: tank farm, columns, pipe racks and a flare ----------
  const pale = new T.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.55, metalness: 0.2 });
  const steel = new T.MeshStandardMaterial({ color: '#8d96a0', roughness: 0.5, metalness: 0.5 });
  const tanks = [];
  [[-250, -190, 3], [-300, 60, 2], [280, -230, 3], [330, 120, 2], [60, -330, 3], [-120, 330, 2]].forEach(([cx, cz, n]) => {
    for (let k = 0; k < n * 2; k++) tanks.push({ x: cx + (k % n) * 42 + R() * 6, z: cz + Math.floor(k / n) * 44 + R() * 6, r: 12 + R() * 7, h: 12 + R() * 8 });
  });
  const tankMesh = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 40), pale, tanks.length);
  tanks.forEach((t, i) => { M4.compose(V.set(t.x, t.h / 2, t.z), Q.identity(), SC.set(t.r, t.h, t.r)); tankMesh.setMatrixAt(i, M4); });
  const roofMesh = new T.InstancedMesh(new T.SphereGeometry(1, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), pale, tanks.length);
  tanks.forEach((t, i) => { M4.compose(V.set(t.x, t.h, t.z), Q.identity(), SC.set(t.r, t.r * 0.18, t.r)); roofMesh.setMatrixAt(i, M4); });
  const cols = [];
  [[-200, -260], [210, -300], [250, 260], [-260, 230]].forEach(([cx, cz]) => { for (let k = 0; k < 5; k++) cols.push({ x: cx + k * 9, z: cz + R() * 8, r: 1.6 + R() * 1.6, h: 34 + R() * 30 }); });
  const colMesh = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 20), steel, cols.length);
  cols.forEach((c, i) => { M4.compose(V.set(c.x, c.h / 2, c.z), Q.identity(), SC.set(c.r, c.h, c.r)); colMesh.setMatrixAt(i, M4); });
  const racks = [[-170, -300, 260, 0], [160, -300, 220, 0], [300, -40, 200, Math.PI / 2], [-330, -60, 220, Math.PI / 2]];
  const rackMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), steel, racks.length * 2);
  racks.forEach(([x, z, len, rot], i) => [5, 9].forEach((y, j) => { Q.setFromAxisAngle(new T.Vector3(0, 1, 0), rot); M4.compose(V.set(x, y, z), Q, SC.set(len, 0.8, 6)); rackMesh.setMatrixAt(i * 2 + j, M4); }));
  const flareX = 360, flareZ = -340, flareH = 80;
  const stack = new T.Mesh(new T.CylinderGeometry(1.2, 2.2, flareH, 16), steel);
  stack.position.set(flareX, flareH / 2, flareZ);
  const flames = [];
  for (let k = 0; k < 6; k++) {
    const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: k < 2 ? '#ffc23a' : '#ff6a12', blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
    m.userData = { s: 10 + k * 3, a: R() * 6 }; flames.push(m);
  }
  const plant = new T.Group();
  plant.add(tankMesh, roofMesh, colMesh, rackMesh, stack, ...flames);
  [tankMesh, roofMesh, colMesh, rackMesh, stack].forEach((m) => { m.castShadow = false; m.receiveShadow = false; });
  scene.add(plant);

  // ---------- warm light under the high-bay lamps at night ----------
  const pools = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex, color: '#ffd9a0', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), 60);
  const beams = new T.InstancedMesh(new T.CylinderGeometry(0.6, 5, 11.4, 24, 1, true), new T.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), 60);
  let li = 0;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) {
    const x = -60 + i * 13.3, z = -32 + j * 12.8;
    Q.setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2); M4.compose(V.set(x, 0.05, z), Q, SC.set(11, 11, 1)); pools.setMatrixAt(li, M4);
    M4.compose(V.set(x, 5.9, z), Q.identity(), SC.set(1, 1, 1)); beams.setMatrixAt(li++, M4);
  }
  pools.renderOrder = 3; beams.renderOrder = 4;
  scene.add(pools, beams);

  // ---------- blue safety spot projected 3 m ahead of each moving forklift ----------
  const spotMat = new T.MeshBasicMaterial({ map: glowTex, color: '#2f7bff', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  const spotGeo = new T.PlaneGeometry(1.4, 1.4);
  function dress() {
    S.forklifts.forEach((f) => {
      if (f.mesh.userData.spot) return;
      const s = new T.Mesh(spotGeo, spotMat.clone()); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.06, -3.4); s.renderOrder = 3;
      f.mesh.add(s); f.mesh.userData.spot = s;
    });
  }

  // ---------- opening fly-in from high above the site ----------
  if (!CAPTURE && !reduced) {
    camera.position.set(-330, 230, 420); controls.target.set(40, 0, -20); controls.update();
    setTimeout(() => B.ui.flyTo([-78, 84, 112], [14, 0, 2], 3.2), 60);
    const v = document.querySelector('[data-view="overview"]'); if (v) v.setAttribute('aria-pressed', 'true');
  }

  let t = 0, dressT = 0;
  B.hooks.frame.push((dt) => {
    t += dt;
    const n = night();
    pools.material.opacity = 0.5 * n; beams.material.opacity = 0.05 * n;
    pools.visible = beams.visible = n > 0.03;
    flames.forEach((m, k) => { const u = m.userData, fl = 0.75 + 0.25 * Math.sin(t * (9 + k) + u.a) + 0.1 * Math.sin(t * 23 + k); m.position.set(flareX + Math.sin(t * 2 + k) * 0.8, flareH + 4 + k * 2.2 * fl, flareZ); const sc = u.s * fl * (0.8 + 0.4 * n); m.scale.set(sc * 0.6, sc * 1.3, 1); m.material.opacity = (n > 0.5 ? 0.55 : 0.85) + 0.15 * fl;
      // additive glow at night; by day a solid orange flame reads better against the bright sky
      const mode = n > 0.5 ? T.AdditiveBlending : T.NormalBlending;
      if (m.material.blending !== mode) { m.material.blending = mode; m.material.needsUpdate = true; } });
    if ((dressT += dt) > 1) { dressT = 0; dress(); }
    S.forklifts.forEach((f) => { const s = f.mesh.userData.spot; if (s) { const moving = (f.path && f.path.length) || f.lift; s.visible = !!moving && !f.down; s.material.opacity = 0.6 + 0.3 * Math.sin(t * 6 + f.n); } });
  });
  dress();
})();
