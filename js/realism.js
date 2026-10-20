/* Building 100 - realism pass: filmic tone mapping, image-based lighting, procedural surface textures, sky, rack bracing, floor markings, operators */
(function () {
  const B = window.B100, W = B.world, S = B.sim, T = THREE;
  const { renderer, scene, sun, hemi } = B.three;
  const R = B.rng(512);
  const CAPTURE = /[?&]capture/.test(location.search);
  const RACK = B.RACK, BLD = B.BUILDING;
  const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;

  // ---------- renderer ----------
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  sun.shadow.normalBias = 0.02;
  // the sun moves slowly: redraw the shadow map every few frames instead of every frame
  renderer.shadowMap.autoUpdate = false;
  let shadowN = 0;
  B.hooks.frame.push(() => { if (renderer.shadowMap.enabled && (CAPTURE || ++shadowN % 3 === 1)) renderer.shadowMap.needsUpdate = true; });

  // image-based light from a simple bright hall, so metal and polished concrete pick up reflections
  (function environment() {
    const env = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(60, 20, 60), new T.MeshBasicMaterial({ color: '#8d8f92', side: T.BackSide }));
    room.position.y = 8; env.add(room);
    const panel = new T.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const p = new T.Mesh(new T.BoxGeometry(6, 0.2, 2.2), panel); p.position.set(i * 11, 17.8, j * 16); env.add(p); }
    const ground = new T.Mesh(new T.BoxGeometry(60, 0.2, 60), new T.MeshBasicMaterial({ color: '#5a5650' })); ground.position.y = -1.9; env.add(ground);
    const sky = new T.Mesh(new T.BoxGeometry(18, 0.2, 60), new T.MeshBasicMaterial({ color: '#cfe3ff' })); sky.position.set(29, 10, 0); sky.rotation.z = Math.PI / 2; env.add(sky);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  })();

  // ---------- procedural textures ----------
  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = maxAniso;
    return t;
  }
  const srgb = (t) => { t.encoding = T.sRGBEncoding; return t; };
  function noise(g, w, h, n, a, b, sz) { for (let k = 0; k < n; k++) { const v = a + R() * (b - a); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + R() * 0.12) + ')'; g.fillRect(R() * w, R() * h, sz * (0.5 + R()), sz * (0.5 + R())); } }
  function blotches(g, w, h, n, col, rmax) { for (let k = 0; k < n; k++) { const x = R() * w, y = R() * h, r = rmax * (0.3 + R()), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }

  // polished concrete with saw-cut joints every 6 m (one tile = 12 x 12 m)
  const concrete = (rough) => canvas(1024, 1024, (g, w, h) => {
    g.fillStyle = rough ? '#8c8c8c' : '#c4c6c8'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 40, rough ? 'rgba(255,255,255,0.10)' : 'rgba(120,118,112,0.10)', 180);
    blotches(g, w, h, 18, rough ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)', 120);
    noise(g, w, h, 9000, 90, 230, 2.2);
    g.strokeStyle = rough ? 'rgba(255,255,255,0.6)' : 'rgba(70,70,70,0.55)'; g.lineWidth = 2.2;
    [0, 512].forEach((p) => { g.beginPath(); g.moveTo(p + 1, 0); g.lineTo(p + 1, h); g.moveTo(0, p + 1); g.lineTo(w, p + 1); g.stroke(); });
    if (!rough) for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(30,30,30,' + (0.05 + R() * 0.08) + ')'; g.lineWidth = 8 + R() * 10; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 90 - 45, w * 0.7, y + R() * 90 - 45, w, y + R() * 40 - 20); g.stroke(); }
  });
  const floorMap = srgb(concrete(false)), floorRough = concrete(true);
  [floorMap, floorRough].forEach((t) => t.repeat.set((BLD.x1 - BLD.x0) / 12, (BLD.z1 - BLD.z0) / 12));
  W.floor.material = new T.MeshStandardMaterial({ map: floorMap, roughnessMap: floorRough, roughness: 0.62, metalness: 0.0, color: '#ffffff' });

  const sandMap = srgb(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#f2ece0'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5 + R() * 7) { g.strokeStyle = 'rgba(150,120,80,' + (0.02 + R() * 0.03) + ')'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin((x / w) * Math.PI * 4 + y * 0.3) * 2.5); g.stroke(); }
    noise(g, w, h, 7000, 150, 255, 1.4);
  }));
  sandMap.repeat.set(60, 60);
  W.sand.material.map = sandMap; W.sand.material.needsUpdate = true;

  const asphaltMap = srgb(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#9a9ca0'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 16000, 60, 220, 1.6);
    blotches(g, w, h, 10, 'rgba(0,0,0,0.04)', 120);
  }));
  asphaltMap.repeat.set(14, 14);
  Object.assign(W.asphalt, { map: asphaltMap, color: new T.Color('#5c5f64') }); W.asphalt.needsUpdate = true;

  // timber pallet deck boards
  const woodMap = srgb(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 7; k++) {
      const x = k * (w / 7) + 3, bw = w / 7 - 8, base = 150 + R() * 40;
      g.fillStyle = 'rgb(' + base + ',' + (base * 0.74) + ',' + (base * 0.48) + ')'; g.fillRect(x, 0, bw, h);
      for (let l = 0; l < 26; l++) { g.strokeStyle = 'rgba(90,60,30,' + (0.1 + R() * 0.2) + ')'; g.lineWidth = 1; g.beginPath(); const xx = x + R() * bw; g.moveTo(xx, 0); g.bezierCurveTo(xx + R() * 6 - 3, h * 0.3, xx + R() * 6 - 3, h * 0.6, xx + R() * 4 - 2, h); g.stroke(); }
      g.fillStyle = 'rgba(40,40,40,0.8)'; [0.2, 0.8].forEach((p) => g.fillRect(x + bw / 2 - 2, h * p, 4, 4));
    }
  }));
  const pb = W.palletBase.material;
  Object.assign(pb, { map: woodMap, color: new T.Color('#ffffff'), roughness: 0.85 }); pb.needsUpdate = true;

  // stacked cartons wrapped in stretch film: seams, tape and a white label, tinted by the category colour
  const cartonMap = srgb(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#e9e1d2'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 3000, 150, 255, 2);
    g.strokeStyle = 'rgba(60,45,30,0.55)'; g.lineWidth = 5;
    [[0, h / 2, w, h / 2], [w / 2, 0, w / 2, h / 2], [w / 3, h / 2, w / 3, h], [(2 * w) / 3, h / 2, (2 * w) / 3, h]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,0.35)'; [h * 0.22, h * 0.74].forEach((y) => g.fillRect(0, y, w, 16));
    g.fillStyle = '#ffffff'; g.fillRect(w * 0.08, h * 0.58, w * 0.18, h * 0.12);
    g.fillStyle = '#222'; for (let k = 0; k < 14; k++) g.fillRect(w * 0.09 + k * 6, h * 0.6, k % 3 ? 2 : 4, h * 0.05);
    for (let k = 0; k < 10; k++) { g.strokeStyle = 'rgba(255,255,255,' + (0.12 + R() * 0.15) + ')'; g.lineWidth = 3 + R() * 6; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.lineTo(w, y + R() * 60 - 30); g.stroke(); }
  }));
  const pl = W.palletLoad.material;
  Object.assign(pl, { map: cartonMap, roughness: 0.48, metalness: 0.02 }); pl.needsUpdate = true;

  // ---------- sky dome follows the scene colour (day, dusk, night) ----------
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, uniforms: { top: { value: new T.Color() }, hor: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunK: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform float sunK; varying vec3 vP; void main(){ vec3 d = normalize(vP); float k = smoothstep(-0.05, 0.55, d.y); float s = max(dot(d, sunDir), 0.0); vec3 c = mix(hor, top, k) + sunK * (vec3(1.0, 0.86, 0.6) * pow(s, 24.0) * 0.35 + vec3(1.0, 0.97, 0.9) * pow(s, 900.0) * 1.2); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new T.Mesh(new T.SphereGeometry(950, 32, 16), skyMat);
  sky.renderOrder = -10; scene.add(sky);
  function paintSky() {
    const bg = scene.background && scene.background.isColor ? scene.background : new T.Color('#dbe2e8');
    const lum = bg.r + bg.g + bg.b;
    skyMat.uniforms.hor.value.copy(bg).lerp(new T.Color('#f4e9d6'), lum > 1.2 ? 0.25 : 0.05);
    skyMat.uniforms.sunDir.value.copy(sun.position).normalize();
    skyMat.uniforms.sunK.value = Math.max(0, Math.min(1, (hemi.intensity / baseHemi - 0.3) / 0.7));
    skyMat.uniforms.top.value.copy(bg).lerp(new T.Color(lum > 1.2 ? '#4a85cc' : '#0a1426'), 0.7);
  }

  // ---------- rack bracing, column guards and end barriers ----------
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3();
  const H = RACK.levels * RACK.levelH + 0.25, steps = 6, frames = RACK.rows.length * (RACK.bays + 1);
  const brace = new T.InstancedMesh(new T.BoxGeometry(0.04, 1, 0.04), W.mat('#2b5c9c', { metalness: 0.5, roughness: 0.45 }), frames * steps);
  const guard = new T.InstancedMesh(new T.BoxGeometry(0.22, 0.45, 0.2), W.mat('#f2b31b', { roughness: 0.55 }), frames);
  let bi = 0, gi = 0;
  const seg = (x, y0, z0, y1, z1) => {
    const dy = y1 - y0, dz = z1 - z0, l = Math.hypot(dy, dz);
    Q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.atan2(dz, dy));
    M4.compose(V.set(x, (y0 + y1) / 2, (z0 + z1) / 2), Q, SC.set(1, l, 1));
    brace.setMatrixAt(bi++, M4);
  };
  RACK.rows.forEach((row) => {
    const za = row.z - RACK.depth / 2, zb = row.z + RACK.depth / 2;
    for (let b = 0; b <= RACK.bays; b++) {
      const x = RACK.x0 + b * RACK.bayW;
      for (let k = 0; k < steps; k++) { const y0 = 0.15 + (k * (H - 0.3)) / steps, y1 = 0.15 + ((k + 1) * (H - 0.3)) / steps; seg(x, y0, k % 2 ? zb : za, y1, k % 2 ? za : zb); }
      M4.makeTranslation(x, 0.23, row.access < row.z ? za - 0.12 : zb + 0.12); guard.setMatrixAt(gi++, M4);
    }
  });
  brace.receiveShadow = guard.receiveShadow = true;
  scene.add(brace, guard);
  const endBar = W.mat('#f2b31b', { roughness: 0.5 });
  RACK.rows.forEach((row) => [RACK.x0 - 0.45, RACK.x0 + RACK.bays * RACK.bayW + 0.45].forEach((x) => {
    const g = new T.Mesh(new T.BoxGeometry(0.16, 0.7, RACK.depth + 0.3), endBar); g.position.set(x, 0.35, row.z); g.castShadow = true; scene.add(g);
  }));

  // soft contact shadow under each rack row
  const aoTex = canvas(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  aoTex.wrapS = aoTex.wrapT = T.ClampToEdgeWrapping;
  const aoMat = new T.MeshBasicMaterial({ map: aoTex, color: '#000000', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
  for (let k = 0; k < RACK.pairs; k++) {
    const zc = (RACK.rows[2 * k].z + RACK.rows[2 * k + 1].z) / 2;
    const p = new T.Mesh(new T.PlaneGeometry(RACK.bays * RACK.bayW + 1, RACK.depth * 2 + RACK.back + 1.6), aoMat);
    p.rotation.x = -Math.PI / 2; p.position.set(RACK.x0 + (RACK.bays * RACK.bayW) / 2, 0.022, zc); scene.add(p);
  }

  // ---------- roof trusses, purlins and sprinkler mains ----------
  const steel = W.mat('#5d6773', { metalness: 0.6, roughness: 0.45 }), red = W.mat('#b8261c', { roughness: 0.5, metalness: 0.2 });
  const roof = new T.Group();
  const xs = []; for (let x = BLD.x0 + 11.5; x < BLD.x1; x += 11.5) xs.push(x);
  const D = BLD.z1 - BLD.z0, zs = []; for (let z = BLD.z0; z < BLD.z1; z += 4) zs.push(z);
  const chords = new T.InstancedMesh(new T.BoxGeometry(0.25, 0.35, D), steel, xs.length * 2);
  const diags = new T.InstancedMesh(new T.BoxGeometry(0.08, 2.1, 0.08), steel, xs.length * zs.length);
  let ci = 0, di = 0;
  xs.forEach((x) => {
    M4.makeTranslation(x, BLD.h - 0.2, 0); chords.setMatrixAt(ci++, M4);
    M4.makeScale(0.72, 0.57, 1).setPosition(x, BLD.h - 1.7, 0); chords.setMatrixAt(ci++, M4);
    zs.forEach((z) => { Q.setFromAxisAngle(new T.Vector3(1, 0, 0), (z / 4) % 2 ? 0.75 : -0.75); M4.compose(V.set(x, BLD.h - 0.95, z + 1), Q, SC.set(1, 1, 1)); diags.setMatrixAt(di++, M4); });
  });
  const zp = []; for (let z = BLD.z0 + 5; z < BLD.z1; z += 10) zp.push(z);
  const purl = new T.InstancedMesh(new T.BoxGeometry(BLD.x1 - BLD.x0, 0.12, 0.12), steel, zp.length);
  zp.forEach((z, k) => { M4.makeTranslation(0, BLD.h - 0.05, z); purl.setMatrixAt(k, M4); });
  const spr = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, BLD.x1 - BLD.x0, 10), red, 3);
  [-22, 3, 28].forEach((z, k) => { Q.setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2); M4.compose(V.set(0, BLD.h - 2.2, z), Q, SC.set(1, 1, 1)); spr.setMatrixAt(k, M4); });
  roof.add(chords, diags, purl, spr);
  scene.add(roof);

  // ---------- floor markings: pedestrian crossings and dock hatching ----------
  const paint = (w, d, col, x, z, rot, op) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ color: col, roughness: 0.7, transparent: op != null, opacity: op == null ? 1 : op, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot || 0; m.position.set(x, 0.033, z); m.receiveShadow = true; scene.add(m); return m;
  };
  const L = B.LANES;
  [[-12, L.front], [-46, L.front], [30, L.back], [-6, L.back]].forEach(([x, z]) => { for (let k = -2; k <= 2; k++) paint(3, 0.45, '#f4f4f0', x, z + k * 0.75); paint(0.12, 4, '#2f9e5b', x - 1.6, z); paint(0.12, 4, '#2f9e5b', x + 1.6, z); });
  const hatch = srgb(canvas(128, 128, (g, w, h) => { g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2b31b'; g.lineWidth = 22; for (let k = -w; k < w * 2; k += 46) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); } }));
  hatch.repeat.set(2, 1);
  W.doorsIn.concat(W.doorsOut).forEach((d) => { const m = paint(4, 1.4, '#ffffff', d.x, d.z + d.dir * 2.4); m.material.map = hatch; m.material.needsUpdate = true; });

  // dock shelters and bumpers
  const shelter = W.mat('#23272b', { roughness: 0.9 }), bumper = W.mat('#111111', { roughness: 0.95 });
  W.doorsIn.concat(W.doorsOut).forEach((d) => {
    [-1, 1].forEach((s) => { const m = new T.Mesh(new T.BoxGeometry(0.5, 4.6, 0.6), shelter); m.position.set(d.x + s * 2.05, 2.3, d.z - d.dir * 0.3); scene.add(m); const b = new T.Mesh(new T.BoxGeometry(0.4, 0.5, 0.25), bumper); b.position.set(d.x + s * 1.3, 0.9, d.z - d.dir * 0.2); scene.add(b); });
    const top = new T.Mesh(new T.BoxGeometry(4.6, 0.6, 0.6), shelter); top.position.set(d.x, 4.6, d.z - d.dir * 0.3); scene.add(top);
  });

  // ---------- forklift operators ----------
  const vest = W.mat('#f26a1b', { roughness: 0.8 }), skin = W.mat('#a8754f', { roughness: 0.7 }), helmet = W.mat('#f4f4f0', { roughness: 0.4 });
  function crew() {
    S.forklifts.forEach((f) => {
      if (f.mesh.userData.op) return;
      const g = new T.Group();
      const torso = new T.Mesh(new T.BoxGeometry(0.42, 0.55, 0.26), vest); torso.position.y = 1.78;
      const head = new T.Mesh(new T.SphereGeometry(0.12, 14, 10), skin); head.position.y = 2.17;
      const hat = new T.Mesh(new T.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmet); hat.position.y = 2.2;
      [-1, 1].forEach((s) => { const arm = new T.Mesh(new T.BoxGeometry(0.1, 0.42, 0.1), vest); arm.position.set(s * 0.26, 1.72, -0.12); arm.rotation.x = 0.9; g.add(arm); });
      g.add(torso, head, hat); g.position.z = 0.5;
      g.traverse((o) => (o.castShadow = true));
      f.mesh.add(g); f.mesh.userData.op = g;
    });
  }

  // ---------- keep overlays out of tone mapping and dim reflections with the daylight ----------
  const std = new Set(), seen = new WeakSet();
  function sweep() {
    scene.traverse((o) => {
      if (!o.material) return;
      [].concat(o.material).forEach((m) => {
        if (seen.has(m)) return; seen.add(m);
        if (m.isSpriteMaterial || m.isMeshBasicMaterial || m.isLineBasicMaterial || m.isLineDashedMaterial) { if (m.toneMapped !== false && m !== aoMat) { m.toneMapped = false; m.needsUpdate = true; } }
        else if (m.isMeshStandardMaterial) std.add(m);
      });
    });
  }
  const baseHemi = hemi.intensity;
  let t = 0, lastK = -1;
  B.hooks.frame.push((dt) => {
    const cy = B.three.camera.position.y;
    sky.position.copy(B.three.camera.position);
    roof.visible = W.shell.visible && (cy < BLD.h - 1.2 || cy > 60);
    if ((t += dt) < 1.5) return;
    t = 0;
    crew(); sweep(); paintSky();
    const k = Math.max(0.12, Math.min(1, hemi.intensity / baseHemi));
    if (Math.abs(k - lastK) > 0.02) { lastK = k; std.forEach((m) => (m.envMapIntensity = 0.42 * k)); }
  });
  crew(); sweep(); paintSky();
  B.realism = { sweep };
})();
