/* Building 19 - in the car park: two big American pickups and two black cruiser motorcycles */
(function () {
  const B = window.B100, T = THREE;
  const { merge, mt, canvas } = B.loads;
  const site = B.visuals.site;
  const Y = new T.Vector3(0, 1, 0), A = new T.Vector3(), D = new T.Vector3(), Q = new T.Quaternion();
  const rotZ = (x, y, z) => mt(x, y, z);
  // a round bar between two points
  function tube(a, b, r, color) {
    A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = A.length(); A.normalize(); Q.setFromUnitVectors(Y, A);
    return [new T.CylinderGeometry(r, r, len, 7), new T.Matrix4().compose(D.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), Q, new T.Vector3(1, 1, 1)), color];
  }
  const axleZ = (x, y, z) => new T.Matrix4().compose(D.set(x, y, z), Q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2), new T.Vector3(1, 1, 1));

  // ---------- full-size crew-cab pickup: tall square nose, big cross grille, open bed ----------
  function pickup(paint) {
    const s = new T.Shape();
    s.moveTo(-2.95, 0.55); s.lineTo(-2.95, 1.26); s.lineTo(-0.98, 1.26); s.lineTo(-0.85, 1.4); s.lineTo(-0.72, 1.95); s.lineTo(0.72, 1.97); s.lineTo(1.42, 1.44); s.lineTo(2.62, 1.36); s.quadraticCurveTo(2.95, 1.32, 2.97, 1.12); s.lineTo(2.97, 0.55); s.closePath();
    const body = new T.ExtrudeGeometry(s, { depth: 2.0, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 5 }).toNonIndexed(); body.translate(0, 0, -1); body.computeVertexNormals();
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const parts = [
      [body, new T.Matrix4(), paint],
      [box(1.86, 0.06, 1.74), mt(-1.92, 1.28, 0), '#17191c'], // bed liner
      [box(1.72, 0.42, 2.07), mt(0.13, 1.68, 0), '#10151b'], // side glass
      [box(0.03, 0.42, 1.78), mt(-0.75, 1.68, 0), '#10151b'], // rear glass
      [box(0.86, 0.03, 1.8), new T.Matrix4().compose(D.set(1.11, 1.71, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), -0.65), new T.Vector3(1, 1, 1)), '#10151b'], // windscreen
      [box(0.03, 0.62, 2.06), mt(0.08, 1.05, 0), '#1a1c20'], // door seam
      [box(0.05, 0.48, 1.42), mt(2.98, 0.94, 0), '#0d0e10'], // grille
      [box(0.06, 0.07, 1.44), mt(3, 0.94, 0), '#d7dadf'], [box(0.06, 0.5, 0.09), mt(3, 0.94, 0), '#d7dadf'], // cross
      [box(0.06, 0.25, 0.3), mt(2.98, 1.0, 0.84), '#eef3f8'], [box(0.06, 0.25, 0.3), mt(2.98, 1.0, -0.84), '#eef3f8'], // headlights
      [box(0.26, 0.24, 2.08), mt(2.94, 0.52, 0), '#c6cad0'], [box(0.2, 0.2, 2.06), mt(-2.97, 0.56, 0), '#c6cad0'], // bumpers
      [box(0.05, 0.42, 0.16), mt(-2.97, 1.02, 0.93), '#a3131a'], [box(0.05, 0.42, 0.16), mt(-2.97, 1.02, -0.93), '#a3131a'], // tail lights
      [box(1.7, 0.07, 2.24), mt(0.1, 0.48, 0), '#1a1c20'], // side steps
      [box(0.12, 0.24, 0.3), mt(1.28, 1.56, 1.14), '#191b1f'], [box(0.12, 0.24, 0.3), mt(1.28, 1.56, -1.14), '#191b1f'], // mirrors
      [box(5.7, 0.3, 1.5), mt(0, 0.42, 0), '#16181b'], // chassis
    ];
    [[-1.85, 1], [-1.85, -1], [1.85, 1], [1.85, -1]].forEach(([x, sd]) => {
      parts.push([new T.CylinderGeometry(0.58, 0.58, 0.02, 20), axleZ(x, 0.48, sd * 1.008), '#0c0d0f']); // wheel arch
      parts.push([new T.CylinderGeometry(0.47, 0.47, 0.34, 20), axleZ(x, 0.47, sd * 0.88), '#101114']); // tyre
      parts.push([new T.CylinderGeometry(0.27, 0.27, 0.03, 16), axleZ(x, 0.47, sd * 1.055), '#c6cad0']); // rim
      parts.push([new T.CylinderGeometry(0.09, 0.09, 0.04, 8), axleZ(x, 0.47, sd * 1.07), '#3a3d42']);
    });
    return merge(parts);
  }
  const truckMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55 });

  // ---------- black cruiser: low frame, V-twin, chrome forks and pipes, club handlebars ----------
  function bike(tank, bars) {
    const BLK = '#0c0d0f', CHR = '#d9dde2', DRK = '#25272b', p = [];
    const FX = 0.86, RX = -0.8, WY = 0.36;
    // wheels
    [[FX, 0.3, 0.05], [RX, 0.285, 0.075]].forEach(([x, r, t]) => {
      p.push([new T.TorusGeometry(r, t, 8, 26), mt(x, WY, 0), '#101114']);
      p.push([new T.TorusGeometry(r - 0.05, 0.012, 5, 22), mt(x, WY, 0), CHR]);
      p.push([new T.CylinderGeometry(0.055, 0.055, 0.16, 10), axleZ(x, WY, 0), CHR]);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI; p.push(tube([x - Math.cos(a) * (r - 0.05), WY - Math.sin(a) * (r - 0.05), 0], [x + Math.cos(a) * (r - 0.05), WY + Math.sin(a) * (r - 0.05), 0], 0.005, CHR)); }
    });
    // fenders
    p.push([new T.TorusGeometry(0.385, 0.05, 6, 16, Math.PI * 0.72), new T.Matrix4().compose(D.set(RX, WY, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), 0.72), new T.Vector3(1, 1, 1.5)), tank]);
    p.push([new T.TorusGeometry(0.365, 0.035, 6, 14, Math.PI * 0.5), new T.Matrix4().compose(D.set(FX, WY, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), 0.7), new T.Vector3(1, 1, 1.4)), tank]);
    // frame
    const neck = [0.5, 1.0], seatB = [-0.48, 0.72], low = [0.28, 0.25], lowR = [-0.28, 0.25];
    [-0.07, 0.07].forEach((z) => { p.push(tube([low[0], low[1], z], [lowR[0], lowR[1], z], 0.016, BLK), tube([lowR[0], lowR[1], z], [RX, WY, z * 1.7], 0.016, BLK), tube([seatB[0], seatB[1], z * 1.3], [RX, WY, z * 1.7], 0.016, BLK), tube([seatB[0], seatB[1], z * 1.3], [lowR[0], lowR[1], z], 0.016, BLK)); });
    p.push(tube([neck[0], neck[1], 0], [low[0], low[1], 0], 0.024, BLK), tube([neck[0], neck[1], 0], [seatB[0], seatB[1], 0], 0.024, BLK));
    // rear shocks and swingarm in chrome
    [-0.13, 0.13].forEach((z) => p.push(tube([-0.68, 0.42, z], [-0.52, 0.76, z], 0.024, CHR)));
    // V-twin: crankcase, two finned cylinders, primary cover
    p.push([new T.SphereGeometry(0.14, 12, 9), new T.Matrix4().compose(D.set(0.02, 0.36, 0), Q.identity(), new T.Vector3(1.2, 1, 0.75)), DRK]);
    p.push([new T.CylinderGeometry(0.135, 0.135, 0.05, 16), axleZ(0.02, 0.36, 0.115), CHR]);
    [[0.42, 0.14], [-0.42, -0.1]].forEach(([ang, ox]) => {
      const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -ang);
      for (let k = 0; k < 5; k++) p.push([new T.CylinderGeometry(0.082, 0.082, 0.02, 12), new T.Matrix4().compose(D.set(ox + Math.sin(ang) * (0.06 + k * 0.042), 0.48 + Math.cos(ang) * (0.03 + k * 0.042), 0), q, new T.Vector3(1, 1, 1)), k % 2 ? '#6e7278' : '#2a2c30']);
      p.push([new T.CylinderGeometry(0.055, 0.07, 0.05, 12), new T.Matrix4().compose(D.set(ox + Math.sin(ang) * 0.27, 0.48 + Math.cos(ang) * 0.24, 0), q, new T.Vector3(1, 1, 1)), CHR]);
    });
    // twin exhausts down the right side
    [[0.17, 0.27], [0.22, 0.2]].forEach(([z, y]) => { p.push(tube([0.1, 0.46, z - 0.08], [-0.1, y, z], 0.026, CHR), tube([-0.1, y, z], [-1.08, y + 0.05, z + 0.03], 0.03, CHR)); });
    // tank, seat, oil tank
    p.push([new T.SphereGeometry(0.3, 16, 10), new T.Matrix4().compose(D.set(0.2, 0.9, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), 0.1), new T.Vector3(1.05, 0.47, 0.44)), tank]);
    p.push([new T.SphereGeometry(0.03, 8, 6), mt(0.2, 1.03, 0), CHR]);
    p.push([new T.BoxGeometry(0.46, 0.07, 0.28), new T.Matrix4().compose(D.set(-0.26, 0.77, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), 0.12), new T.Vector3(1, 1, 1)), '#17120e']);
    p.push([new T.BoxGeometry(0.26, 0.09, 0.2), new T.Matrix4().compose(D.set(-0.56, 0.79, 0), Q.setFromAxisAngle(new T.Vector3(0, 0, 1), -0.14), new T.Vector3(1, 1, 1)), '#17120e']);
    p.push([new T.BoxGeometry(0.2, 0.16, 0.2), mt(-0.24, 0.52, 0), BLK]);
    // forks, triple tree, headlight, gauge
    [-0.09, 0.09].forEach((z) => { p.push(tube([FX, WY, z], [neck[0] + 0.01, 1.04, z], 0.021, CHR)); });
    p.push([new T.BoxGeometry(0.1, 0.04, 0.24), mt(0.5, 1.05, 0), CHR]);
    p.push([new T.SphereGeometry(0.09, 12, 9), new T.Matrix4().compose(D.set(0.65, 1.07, 0), Q.identity(), new T.Vector3(1.05, 1, 1)), CHR]);
    p.push([new T.CircleGeometry(0.075, 12), new T.Matrix4().compose(D.set(0.75, 1.07, 0), Q.setFromAxisAngle(Y, Math.PI / 2), new T.Vector3(1, 1, 1)), '#f5f7fa']);
    // handlebars: risers then a wide bar with black grips
    const H = bars;
    [-1, 1].forEach((sd) => {
      p.push(tube([0.47, 1.06, sd * 0.07], [0.42, H, sd * 0.15], 0.012, BLK));
      p.push(tube([0.42, H, sd * 0.15], [0.3, H - 0.02, sd * 0.38], 0.012, BLK));
      p.push(tube([0.3, H - 0.02, sd * 0.38], [0.26, H - 0.02, sd * 0.48], 0.017, '#0a0a0a'));
    });
    p.push(tube([0.42, H, -0.15], [0.42, H, 0.15], 0.012, BLK));
    // foot pegs and kickstand on the left
    [-0.2, 0.2].forEach((z) => p.push(tube([0.12, 0.24, z], [0.12, 0.24, z * 1.5], 0.012, DRK)));
    p.push(tube([-0.05, 0.24, -0.1], [-0.1, 0.01, -0.34], 0.012, CHR));
    return merge(p);
  }
  const bikeMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.72, side: T.DoubleSide });

  // ---------- parked ----------
  const row = (k) => -114.9 + k * 4.2;
  const place = (geo, mat, x, z, yaw, lean) => { const m = new T.Mesh(geo, mat); m.position.set(x, 0, z); m.rotation.order = 'YXZ'; m.rotation.set(lean || 0, yaw, 0); m.castShadow = true; m.receiveShadow = true; site.add(m); return m; };
  place(pickup('#15171a'), truckMat, row(3), 81, Math.PI / 2);
  place(pickup('#8c1414'), truckMat, row(4), 81, Math.PI / 2);
  // backed in side by side, leaning on their stands
  const bike1 = bike('#08090a', 1.2), bike2 = bike('#141518', 1.27);
  place(bike1, bikeMat, row(6) - 0.85, 56.4, -Math.PI / 2 + 0.16, -0.14);
  place(bike2, bikeMat, row(6) + 0.85, 56.4, -Math.PI / 2 + 0.16, -0.14);

  // soft shadow under each, for when the sun's shadow map does not reach this far
  const blob = canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.65, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const blobMat = new T.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, toneMapped: false });
  [[row(3), 81, 3.1, 7], [row(4), 81, 3.1, 7], [row(6) - 0.85, 56.4, 1, 2.9], [row(6) + 0.85, 56.4, 1, 2.9]].forEach(([x, z, w, d]) => { const s = new T.Mesh(new T.PlaneGeometry(w, d), blobMat); s.rotation.x = -Math.PI / 2; s.position.set(x, 0.02, z); s.renderOrder = 1; site.add(s); });
  B.parked = { spots: { rams: [[row(3), 81], [row(4), 81]], bikes: [[row(6) - 0.85, 56.4], [row(6) + 0.85, 56.4]] } };
})();
