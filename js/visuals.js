/* Building 19 - graphics: real sky with clouds and stars, dunes, the site around the building, sun shafts, polished floor reflections, dust in the air */
(function () {
  const B = window.B100, W = B.world, S = B.sim, T = THREE;
  const { renderer, scene, camera, sun, hemi } = B.three;
  const CAPTURE = /[?&]capture/.test(location.search);
  const R = B.rng(1919);
  const { merge, mt, canvas } = B.loads;
  const BLD = B.BUILDING;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

  // instanced meshes are drawn from one origin: never let the camera angle cull them
  const unCull = () => scene.traverse((o) => { if (o.isInstancedMesh) o.frustumCulled = false; });

  // ---------- sky: deep blue overhead, haze at the horizon, drifting cirrus, stars at night ----------
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { zen: { value: new T.Color() }, hor: { value: new T.Color() }, sunCol: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) }, tm: { value: 0 }, day: { value: 1 }, dust: { value: 0 }, gam: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; uniform float tm; uniform float day; uniform float dust; uniform float gam; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int k=0;k<5;k++){ s+=a*n(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
      void main(){ vec3 d=normalize(vD); float y=max(d.y,0.);
        vec3 c=mix(hor,zen,pow(smoothstep(0.,.62,y),.62));
        float s=max(dot(d,sunDir),0.);
        c+=sunCol*(pow(s,1400.)*4.+pow(s,60.)*.32+pow(s,6.)*.1*day)*(1.-dust*.8);
        if(d.y>.005){ vec2 q=d.xz/(d.y+.14); float cl=fbm(q*vec2(.9,1.8)+vec2(tm*.012,tm*.004)); cl=smoothstep(.5,.86,cl)*smoothstep(.01,.2,d.y);
          vec3 cc=mix(vec3(.07,.09,.15),vec3(1.,.985,.96),day)+sunCol*.3*pow(s,5.); c=mix(c,cc,cl*.72*(1.-dust)); }
        float dark=1.-smoothstep(.09,.2,dot(hor,vec3(.333))); if(dark>0.&&d.y>0.){ vec2 g=floor(d.xz/(d.y+.5)*240.); float st=step(.9975,h(g)); c+=vec3(st)*dark*(.45+.55*h(g+1.)); }
        gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(gam)),1.); }`,
  });
  scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.radius === 950) o.material = skyMat; });

  const ZEN = { day: new T.Color('#1b5cb5'), dusk: new T.Color('#2a3c78'), night: new T.Color('#040813') };
  const HOR = { day: new T.Color('#cfe0ec'), dusk: new T.Color('#f2a877'), night: new T.Color('#101a2e') };
  const SUN = { day: new T.Color('#fff2d8'), dusk: new T.Color('#ff9a4c') };
  const c1 = new T.Color(), c2 = new T.Color();
  function paintSky(tm) {
    const h = ((S.st.t / 3600) % 24 + 24) % 24;
    const day = smooth(5.4, 7.2, h) * (1 - smooth(17, 18.8, h));
    const dusk = clamp01(1 - Math.abs(h - 6) / 1.5) + clamp01(1 - Math.abs(h - 18) / 1.5);
    const u = skyMat.uniforms, dust = B.weather && B.weather.state.dust ? 1 : 0;
    c1.copy(ZEN.night).lerp(ZEN.day, day).lerp(ZEN.dusk, dusk * 0.75);
    c2.copy(HOR.night).lerp(HOR.day, day).lerp(HOR.dusk, dusk * 0.85);
    if (dust && scene.background && scene.background.isColor) { c2.copy(scene.background); c1.copy(scene.background).multiplyScalar(0.88); }
    u.zen.value.copy(c1); u.hor.value.copy(c2);
    u.sunCol.value.copy(SUN.day).lerp(SUN.dusk, clamp01(dusk));
    u.sunDir.value.copy(sun.position).normalize(); u.tm.value = tm; u.day.value = day; u.dust.value = dust;
    u.gam.value = B.cinematic && B.cinematic.isOn() ? 2.2 : 1;
    if (scene.fog && !dust) scene.fog.color.copy(c2);
  }

  // ---------- ground: dunes and colour drift, far past the old edge of the site ----------
  (function dunes() {
    const SEG = 150, SIZE = 2400, geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG), p = geo.attributes.position, col = new Float32Array(p.count * 3), uv = geo.attributes.uv;
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, a = f * f * (3 - 2 * f), b = g * g * (3 - 2 * g); return (hash(i, j) * (1 - a) + hash(i + 1, j) * a) * (1 - b) + (hash(i, j + 1) * (1 - a) + hash(i + 1, j + 1) * a) * b; };
    const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1 + 5, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 9) * 0.15;
    const light = new T.Color('#e4cfa8'), dark = new T.Color('#9d8058'), c = new T.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), rise = smooth(480, 950, r), d = fbm(x / 130, y / 130);
      p.setZ(i, rise * Math.pow(d, 1.6) * 62);
      c.copy(dark).lerp(light, clamp01(0.25 + d * 0.95));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      uv.setXY(i, uv.getX(i) * 60, uv.getY(i) * 60);
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    W.sand.geometry = geo;
    W.sand.material.vertexColors = true;
    if (W.sand.material.map) { W.sand.material.map.wrapS = W.sand.material.map.wrapT = T.RepeatWrapping; W.sand.material.map.anisotropy = 8; W.sand.material.map.needsUpdate = true; }
    W.sand.material.needsUpdate = true;
  })();

  // ---------- the site around the building: ring road, parking, fence, gate, light poles, palms ----------
  const asph = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#54575c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 16000; k++) { const v = 55 + R() * 70; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',0.5)'; g.fillRect(R() * w, R() * h, 1.6, 1.6); }
    for (let k = 0; k < 9; k++) { g.strokeStyle = 'rgba(25,26,28,0.35)'; g.lineWidth = 1 + R() * 2; g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let q = 0; q < 7; q++) { x += R() * 50 - 25; y += R() * 50 - 25; g.lineTo(x, y); } g.stroke(); }
  });
  asph.wrapS = asph.wrapT = T.RepeatWrapping;
  const asphMat = new T.MeshStandardMaterial({ map: asph, roughness: 0.94, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  Object.assign(W.asphalt, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); W.asphalt.needsUpdate = true;
  const site = new T.Group(); scene.add(site);
  const flat = (w, d) => { const g = new T.PlaneGeometry(w, d); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 16, (u.getY(i) * d) / 16); return g; };
  const flatM = (x, z, y) => mt(x, y == null ? 0 : y, z, 1, 1, 1, -Math.PI / 2);
  const RN = 105, RE = 146, RW = 15;
  const roads = merge([
    [flat(RE * 2 + RW, RW), flatM(0, -RN)], [flat(RE * 2 + RW, RW), flatM(0, RN)], [flat(RW, RN * 2), flatM(RE, 0)], [flat(RW, RN * 2), flatM(-RE, 0)],
    [flat(45, 42), flatM(-97.5, 69)], [flat(16, 30), flatM(-100, 35, -0.005)], [flat(36, 10), flatM(96, -RN + 12, -0.005)],
    [flat(44, 8), flatM(-45, -94, -0.005)], [flat(66, 8), flatM(6, 94, -0.005)],
  ]);
  const roadMesh = new T.Mesh(roads, asphMat); roadMesh.position.y = -0.028; roadMesh.receiveShadow = true; site.add(roadMesh);
  // painted lines
  const paintMat = new T.MeshBasicMaterial({ color: '#e8e8e2', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const paint = [];
  for (let x = -RE; x < RE; x += 9) { paint.push([x, -RN, 4.5, 0.22], [x, RN, 4.5, 0.22]); }
  for (let z = -RN + 10; z < RN - 8; z += 9) { paint.push([RE, z, 0.22, 4.5], [-RE, z, 0.22, 4.5]); }
  for (let k = 0; k < 10; k++) { paint.push([-117 + k * 4.2, 57, 0.14, 7], [-117 + k * 4.2, 81, 0.14, 7]); }
  paint.push([-117 + 4.5 * 4.2, 57 - 3.5, 42, 0.14], [-117 + 4.5 * 4.2, 81 + 3.5, 42, 0.14]);
  const paintMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), paintMat, paint.length);
  const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3(), Y = new T.Vector3(0, 1, 0), C = new T.Color();
  paint.forEach(([x, z, w, d], i) => { Q.setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2); M.compose(V.set(x, 0.012, z), Q, SC.set(w, d, 1)); paintMesh.setMatrixAt(i, M); });
  site.add(paintMesh);

  // parked cars, profile extruded so they read as cars at any distance
  const carGeo = (() => {
    const s = new T.Shape(); s.moveTo(-2.15, 0.3); s.lineTo(-2.15, 0.72); s.quadraticCurveTo(-2.1, 0.86, -1.85, 0.9); s.lineTo(-1.15, 0.96); s.lineTo(-0.55, 1.42); s.lineTo(0.72, 1.44); s.lineTo(1.38, 0.98); s.lineTo(2.05, 0.9); s.quadraticCurveTo(2.2, 0.82, 2.2, 0.62); s.lineTo(2.2, 0.3); s.closePath();
    const body = new T.ExtrudeGeometry(s, { depth: 1.72, bevelEnabled: false }).toNonIndexed(); body.translate(0, 0, -0.86); body.computeVertexNormals();
    const glass = new T.BoxGeometry(1.5, 0.36, 1.74), wheel = new T.CylinderGeometry(0.33, 0.33, 0.24, 14);
    const parts = [[body, new T.Matrix4(), '#ffffff'], [glass, mt(0.08, 1.18, 0), '#141a22']];
    [[-1.35, 0.8], [1.35, 0.8], [-1.35, -0.8], [1.35, -0.8]].forEach(([x, z]) => parts.push([wheel, new T.Matrix4().compose(V.set(x, 0.33, z), Q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2), SC.set(1, 1, 1)), '#111316']));
    return merge(parts);
  })();
  const spots = [];
  for (let k = 0; k < 10; k++) { if (R() < 0.8) spots.push([-114.9 + k * 4.2, 57, Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI)]); if (R() < 0.7) spots.push([-114.9 + k * 4.2, 81, Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI)]); }
  const carCols = ['#f2f3f4', '#f2f3f4', '#c7ccd1', '#1e2226', '#7d8690', '#8c1f1f', '#23457d', '#d7cdb8'];
  const cars = new T.InstancedMesh(carGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55 }), spots.length);
  spots.forEach(([x, z, r], i) => { Q.setFromAxisAngle(Y, r); M.compose(V.set(x, 0, z), Q, SC.set(1, 1, 1)); cars.setMatrixAt(i, M); cars.setColorAt(i, C.set(carCols[Math.floor(R() * carCols.length)])); });
  cars.castShadow = true; cars.receiveShadow = true; site.add(cars);

  // chain-link fence with concrete footings, posts and a gate
  const FX = 172, FZ = 124, GATE = -112;
  const linkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(70,78,86,1)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; })();
  const fenceGeo = [];
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new T.PlaneGeometry(len, 3); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * len) / 0.8, (u.getY(i) * 3) / 0.8);
    fenceGeo.push([g, new T.Matrix4().compose(V.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2), Q.setFromAxisAngle(Y, -Math.atan2(z1 - z0, x1 - x0)), SC.set(1, 1, 1))]);
  };
  run(-FX, -FZ, GATE - 8, -FZ); run(GATE + 8, -FZ, FX, -FZ); run(FX, -FZ, FX, FZ); run(FX, FZ, -FX, FZ); run(-FX, FZ, -FX, -FZ);
  const fence = new T.Mesh(merge(fenceGeo), new T.MeshStandardMaterial({ map: linkTex, alphaMap: null, transparent: true, alphaTest: 0.35, side: T.DoubleSide, roughness: 0.6, metalness: 0.5, depthWrite: true, vertexColors: true }));
  site.add(fence);
  const posts = [];
  const postRun = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 6); for (let k = 0; k <= n; k++) posts.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]); };
  postRun(-FX, -FZ, GATE - 8, -FZ); postRun(GATE + 8, -FZ, FX, -FZ); postRun(FX, -FZ, FX, FZ); postRun(FX, FZ, -FX, FZ); postRun(-FX, FZ, -FX, -FZ);
  const postMesh = new T.InstancedMesh(new T.BoxGeometry(0.12, 3.2, 0.12), new T.MeshStandardMaterial({ color: '#59626b', metalness: 0.6, roughness: 0.45 }), posts.length);
  posts.forEach(([x, z], i) => { M.compose(V.set(x, 1.6, z), Q.identity(), SC.set(1, 1, 1)); postMesh.setMatrixAt(i, M); });
  site.add(postMesh);
  // gate: guard house and striped barrier
  (function gate() {
    const house = W.box(4.6, 3, 3.6, '#f1eee8'); house.position.set(GATE + 12, 1.5, -FZ + 3);
    const roof = W.box(5.6, 0.25, 4.6, '#3a4250'); roof.position.set(GATE + 12, 3.1, -FZ + 3);
    const win = new T.Mesh(new T.BoxGeometry(3.6, 1.2, 0.05), new T.MeshStandardMaterial({ color: '#17232e', roughness: 0.1, metalness: 0.8 })); win.position.set(GATE + 12, 1.9, -FZ + 1.17);
    const stripes = canvas(256, 32, (g, w, h) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f4f4f0' : '#c5281c'; g.fillRect((k * w) / 8, 0, w / 8, h); } });
    const boom = new T.Mesh(new T.BoxGeometry(14, 0.14, 0.14), new T.MeshStandardMaterial({ map: stripes, roughness: 0.5 })); boom.position.set(GATE + 0.6, 1.25, -FZ + 0.6);
    const stand = W.box(0.5, 1.2, 0.5, '#d8a31a'); stand.position.set(GATE + 8, 0.6, -FZ + 0.6);
    const sign = W.makeLabel('SITE GATE', { size: 1.6, bg: 'rgba(16,24,34,0.92)', fg: '#ffffff', weight: 700 }); sign.position.set(GATE + 12, 5, -FZ + 3);
    const gr = new T.Mesh(new T.BoxGeometry(18, 0.04, 8), asphMat); gr.position.set(GATE, -0.01, -FZ + 8);
    site.add(house, roof, win, boom, stand, sign, gr);
    const conn = new T.Mesh(flat(14, 12), asphMat); conn.rotation.x = -Math.PI / 2; conn.position.set(GATE, -0.012, -FZ + 8); conn.receiveShadow = true; site.add(conn);
  })();

  // light poles along the ring road
  const poleSpots = [];
  for (let x = -130; x <= 130; x += 52) { poleSpots.push([x, -RN + 9], [x, RN - 9]); }
  for (let z = -60; z <= 60; z += 60) { poleSpots.push([RE - 9, z]); poleSpots.push([-RE + 9, z]); }
  const poleGeo = merge([[new T.CylinderGeometry(0.1, 0.17, 10, 8), mt(0, 5, 0), '#7a8087'], [new T.BoxGeometry(1.8, 0.1, 0.1), mt(0.8, 10, 0), '#7a8087'], [new T.BoxGeometry(0.8, 0.14, 0.34), mt(1.6, 9.92, 0), '#2a2f35']]);
  const poles = new T.InstancedMesh(poleGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), poleSpots.length);
  poleSpots.forEach(([x, z], i) => { Q.setFromAxisAngle(Y, Math.atan2(z, -x) ); M.compose(V.set(x, 0, z), Q, SC.set(1, 1, 1)); poles.setMatrixAt(i, M); });
  site.add(poles);
  const lampGlow = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.03, 0.26), new T.MeshBasicMaterial({ color: '#ffdca8', toneMapped: false, transparent: true, opacity: 0 }), poleSpots.length);
  poleSpots.forEach(([x, z], i) => { Q.setFromAxisAngle(Y, Math.atan2(z, -x)); V.set(1.6, 9.84, 0).applyQuaternion(Q); M.compose(V.set(V.x + x, 9.84, V.z + z), Q, SC.set(1, 1, 1)); lampGlow.setMatrixAt(i, M); });
  site.add(lampGlow);

  // date palms by the office and the car park
  const palmGeo = (() => {
    const parts = [[new T.CylinderGeometry(0.17, 0.28, 7, 8, 1), mt(0, 3.5, 0), '#7a6248']];
    for (let k = 0; k < 13; k++) {
      const a = (k / 13) * Math.PI * 2, tilt = 0.25 + (k % 3) * 0.32, f = new T.PlaneGeometry(0.6, 3.6, 1, 6), p = f.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = p.getY(i) + 1.8, w = p.getX(i) * Math.sin((v / 3.6) * Math.PI + 0.25); p.setXYZ(i, w, v, -v * v * 0.13); }
      f.computeVertexNormals();
      parts.push([f, new T.Matrix4().compose(V.set(0, 7, 0), Q.setFromEuler(new T.Euler(tilt, a, 0, 'YXZ')), SC.set(1, 1, 1)), k % 2 ? '#3f6e33' : '#4f8240']);
    }
    return merge(parts);
  })();
  const palmSpots = [[-22, -62], [-8, -66], [6, -62], [20, -66], [34, -62], [-72, 50], [-72, 66], [-72, 82], [-122, 50], [-122, 92], [-96, 96], [70, 58], [86, 66], [102, 58], [60, -60], [76, -66]];
  const palms = new T.InstancedMesh(palmGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: T.DoubleSide }), palmSpots.length);
  palmSpots.forEach(([x, z], i) => { Q.setFromAxisAngle(Y, R() * 6); const s = 0.8 + R() * 0.35; M.compose(V.set(x, 0, z), Q, SC.set(s, s, s)); palms.setMatrixAt(i, M); });
  palms.castShadow = true; site.add(palms);

  // the compound inside the fence is packed gravel, not open sand
  const gravel = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#b4a68c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 26000; k++) { const v = 120 + R() * 90, s = 0.6 + R() * 1.9; g.fillStyle = 'rgba(' + v + ',' + (v - 10) + ',' + (v - 26) + ',0.55)'; g.fillRect(R() * w, R() * h, s, s); }
  });
  gravel.wrapS = gravel.wrapT = T.RepeatWrapping;
  const yardG = new T.Mesh(flat(FX * 2, FZ * 2), new T.MeshStandardMaterial({ map: gravel, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  yardG.rotation.x = -Math.PI / 2; yardG.position.y = -0.042; yardG.receiveShadow = true; site.add(yardG);

  // ---------- the building reads as a building: white fascia with a blue line, big number on the wall ----------
  (function fascia() {
    const H = BLD.h, W0 = BLD.x1 - BLD.x0, D0 = BLD.z1 - BLD.z0;
    const white = new T.MeshStandardMaterial({ color: '#f4f5f6', roughness: 0.42, metalness: 0.35 }), blue = new T.MeshStandardMaterial({ color: '#14589c', roughness: 0.4, metalness: 0.4 });
    const add = (w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; W.shell.add(b); };
    [[0, BLD.z0, W0 + 0.8, 0.5], [0, BLD.z1, W0 + 0.8, 0.5], [BLD.x0, 0, 0.5, D0 + 0.8], [BLD.x1, 0, 0.5, D0 + 0.8]].forEach(([x, z, w, d]) => { add(w, 1.5, d, x, H - 0.4, z, white); add(w + 0.06, 0.22, d + 0.06, x, H - 0.95, z, blue); });
    const mark = canvas(1024, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#14589c'; g.font = '800 92px Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('BUILDING 19', w / 2, h / 2 + 4); });
    [[-BLD.z0, 1], [-BLD.z1, -1]].forEach(([, side]) => { const p = new T.Mesh(new T.PlaneGeometry(16, 2), new T.MeshBasicMaterial({ map: mark, transparent: true, depthWrite: false, toneMapped: false })); p.position.set(0, H - 0.34, (side > 0 ? BLD.z0 - 0.3 : BLD.z1 + 0.3)); p.rotation.y = side > 0 ? Math.PI : 0; W.shell.add(p); });
  })();

  // clear glass instead of a milky film
  W.shell.traverse((o) => { if (o.isMesh && o.material.transparent && o.material.side === T.DoubleSide && o.material.opacity < 0.2) { o.material.opacity = 0.055; o.material.color.set('#8fb0c8'); o.material.roughness = 0.08; o.material.metalness = 0.75; } });
  const hallFloor = W.floor.material;
  hallFloor.color.multiplyScalar(0.8);

  // ---------- sun shafts through the roof lights and dust drifting in the hall ----------
  const shaftTex = canvas(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,245,220,0.55)'); gr.addColorStop(1, 'rgba(255,245,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.5, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = e; g.fillRect(0, 0, w, h); });
  const shaftSpots = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) shaftSpots.push([-58 + i * 13, -30 + j * 12.4]);
  const shaftMat = new T.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false, opacity: 0, fog: false });
  const shafts = new T.InstancedMesh(new T.PlaneGeometry(4.5, 12), shaftMat, shaftSpots.length * 2);
  shafts.frustumCulled = false; shafts.renderOrder = 5; scene.add(shafts);
  function placeShafts() {
    const d = V.copy(sun.position).normalize(), tilt = Math.atan2(Math.hypot(d.x, d.z), Math.max(0.2, d.y)) * 0.8, dir = Math.atan2(d.x, d.z);
    const qa = new T.Quaternion(), qb = new T.Quaternion();
    shaftSpots.forEach(([x, z], i) => {
      [0, 1].forEach((k) => {
        qa.setFromEuler(new T.Euler(tilt, dir, 0, 'YXZ')); qb.setFromAxisAngle(Y, k * 1.57 + 0.3); qa.multiply(qb);
        const off = new T.Vector3(0, -6, 0).applyQuaternion(qa);
        M.compose(new T.Vector3(x + off.x, 12 + off.y, z + off.z), qa, SC.set(1, 1, 1)); shafts.setMatrixAt(i * 2 + k, M);
      });
    });
    shafts.instanceMatrix.needsUpdate = true;
  }
  const MOTES = 420, motePos = new Float32Array(MOTES * 3), moteV = [];
  for (let k = 0; k < MOTES; k++) { motePos[k * 3] = BLD.x0 + R() * (BLD.x1 - BLD.x0); motePos[k * 3 + 1] = 0.4 + R() * 10; motePos[k * 3 + 2] = BLD.z0 + R() * (BLD.z1 - BLD.z0); moteV.push([(R() - 0.5) * 0.2, (R() - 0.3) * 0.07, (R() - 0.5) * 0.2]); }
  const moteGeo = new T.BufferGeometry(); moteGeo.setAttribute('position', new T.BufferAttribute(motePos, 3));
  const motes = new T.Points(moteGeo, new T.PointsMaterial({ color: '#fff4dc', size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  motes.frustumCulled = false; scene.add(motes);

  // ---------- polished floor: a real mirror image of the hall, sampled with fresnel, while cinematic effects are on ----------
  const REF = { on: false, k: 0.55, skip: 0 };
  const rt = new T.WebGLRenderTarget(1024, 576, { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
  rt.texture.encoding = T.LinearEncoding; rt.texture.generateMipmaps = false;
  const mirror = new T.PerspectiveCamera();
  const refUni = { tRefl: { value: rt.texture }, reflMat: { value: new T.Matrix4() }, reflK: { value: 0 } };
  hallFloor.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, refUni);
    sh.vertexShader = 'uniform mat4 reflMat; varying vec4 vReflUv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vReflUv = reflMat * modelMatrix * vec4(transformed, 1.0);');
    sh.fragmentShader = 'uniform sampler2D tRefl; uniform float reflK; varying vec4 vReflUv;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `if (reflK > 0.001) {
        vec2 ruv = vReflUv.xy / vReflUv.w;
        vec2 e = vec2(0.0016, 0.0028);
        vec3 rc = (texture2D(tRefl, ruv).rgb * 2.0 + texture2D(tRefl, ruv + vec2(e.x, 0.)).rgb + texture2D(tRefl, ruv - vec2(e.x, 0.)).rgb + texture2D(tRefl, ruv + vec2(0., e.y)).rgb + texture2D(tRefl, ruv - vec2(0., e.y)).rgb) / 6.0;
        float cs = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        float fres = 0.12 + 0.88 * pow(1.0 - cs, 3.2);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, rc, reflK * fres);
      }
      #include <tonemapping_fragment>`);
  };
  hallFloor.needsUpdate = true;
  const bias = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const tgtV = new T.Vector3(), dirV = new T.Vector3();
  function renderMirror() {
    camera.getWorldDirection(dirV);
    mirror.fov = camera.fov; mirror.aspect = camera.aspect; mirror.near = camera.near; mirror.far = camera.far; mirror.updateProjectionMatrix();
    mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
    tgtV.copy(camera.position).add(dirV); tgtV.y = -tgtV.y;
    mirror.up.set(0, -1, 0).applyQuaternion(camera.quaternion).setY(-new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).y);
    mirror.up.set(0, 1, 0).applyQuaternion(camera.quaternion); mirror.up.y = -mirror.up.y;
    mirror.lookAt(tgtV); mirror.updateMatrixWorld(true);
    refUni.reflMat.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    const labels = W.labels.visible, tm = renderer.toneMapping, sh = renderer.shadowMap.needsUpdate, target = renderer.getRenderTarget();
    W.labels.visible = false; renderer.toneMapping = T.NoToneMapping; renderer.shadowMap.needsUpdate = false; refUni.reflK.value = 0;
    const tagsWere = B.actors.tagsShown(); B.actors.showTags(false);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, mirror); renderer.setRenderTarget(target);
    B.actors.showTags(tagsWere);
    W.labels.visible = labels; renderer.toneMapping = tm; renderer.shadowMap.needsUpdate = sh; refUni.reflK.value = REF.k;
  }

  // ---------- sharper shadows covering the whole site in Full quality ----------
  const setFull = B.perf.setFull;
  B.perf.setFull = (on) => {
    setFull(on);
    const size = on ? 4096 : 2048, ext = on ? 135 : 90;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: on ? 110 : 70, bottom: on ? -110 : -70 }); sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  };

  // ---------- turn the cinematic look on by itself when the device has room for it ----------
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const box = document.getElementById('lyCine');
  let auto = store.get('b100.cine') !== '0', autoOn = false, fr = 0, acc = 0, grace = 8;
  box.addEventListener('change', (e) => { if (e.isTrusted) { auto = false; store.set('b100.cine', box.checked ? '1' : '0'); } });
  if (store.get('b100.cine') === '1') { box.checked = true; box.dispatchEvent(new Event('change')); }
  function autoQuality(dt) {
    if (!auto || CAPTURE || document.hidden) return;
    fr++; acc += dt; if (acc < 2) return;
    const fps = fr / acc; fr = 0; acc = 0;
    if ((grace -= 2) > 0) return;
    if (!autoOn && fps > 56 && !box.checked && !(document.getElementById('lyLow') || {}).checked) { autoOn = true; box.checked = true; box.dispatchEvent(new Event('change')); grace = 8; }
    else if (autoOn && fps < 34) { autoOn = false; auto = false; box.checked = false; box.dispatchEvent(new Event('change')); }
  }

  // ---------- frame ----------
  let tm = 0, shT = 9, skyT = 0;
  const wasFarFog = () => scene.fog;
  B.hooks.frame.push((dt) => {
    tm += dt;
    if ((skyT += dt) > 0.25 || CAPTURE) { skyT = 0; paintSky(tm); }
    const h = ((S.st.t / 3600) % 24 + 24) % 24, day = smooth(6.5, 8.5, h) * (1 - smooth(16, 17.8, h)), dust = B.weather && B.weather.state.dust;
    const cy = camera.position.y, inside = camera.position.x > BLD.x0 - 40 && camera.position.x < BLD.x1 + 40 && camera.position.z > BLD.z0 - 40 && camera.position.z < BLD.z1 + 40;
    shaftMat.opacity = (dust ? 0.05 : 0.2) * day * (cy < 22 && inside ? 1 : 0.15);
    shafts.visible = shaftMat.opacity > 0.01;
    if (shafts.visible && (shT += dt) > 3) { shT = 0; placeShafts(); }
    motes.visible = cy < 16 && inside;
    if (motes.visible) { const a = moteGeo.attributes.position, sk = dt * 2; for (let k = 0; k < MOTES; k++) { const v = moteV[k]; a.array[k * 3] += v[0] * sk; a.array[k * 3 + 1] += v[1] * sk; a.array[k * 3 + 2] += v[2] * sk; if (a.array[k * 3 + 1] > 11) a.array[k * 3 + 1] = 0.4; if (a.array[k * 3 + 1] < 0.3) a.array[k * 3 + 1] = 10; } a.needsUpdate = true; }
    lampGlow.material.opacity = 1 - day;
    autoQuality(dt);
    REF.on = !!(B.cinematic && B.cinematic.isOn()) && !CAPTURE && cy < 150;
    if (REF.on) { if (++REF.skip % 2 === 0) renderMirror(); refUni.reflK.value = REF.k; } else refUni.reflK.value = 0;
  });
  unCull();
  B.visuals = { sky: skyMat, paintSky, refl: REF, renderMirror, site, unCull };
})();
