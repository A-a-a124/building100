/* Building 100 - vehicle models: electric counterbalance forklift and tractor-trailer, built from extruded profiles for soft edges */
(function () {
  const B = window.B100, T = THREE, W = B.world;
  const M = (color, o) => W.mat(color, o);
  const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const mesh = (geo, mat) => cast(new T.Mesh(geo, mat));

  // side profile (z forward = negative, y up) extruded across the width x
  function profile(points, width, bevel) {
    const s = new T.Shape();
    points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.rotateY(-Math.PI / 2); g.translate((width - 2 * bevel) / 2, 0, 0);
    return g;
  }
  function wheel(r, w, rimColor) {
    const g = new T.Group();
    const tire = mesh(new T.CylinderGeometry(r, r, w, 24), M('#1b1d20', { roughness: 0.95 }));
    const rim = mesh(new T.CylinderGeometry(r * 0.58, r * 0.58, w + 0.02, 16), M(rimColor || '#c9ced3', { metalness: 0.6, roughness: 0.35 }));
    const hub = mesh(new T.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 10), M('#3a3f45', { metalness: 0.6 }));
    g.add(tire, rim, hub); g.rotation.z = Math.PI / 2;
    return g;
  }

  // ---------- forklift: forks point to -z ----------
  const yellow = M('#f2b31b', { roughness: 0.42, metalness: 0.15 }), dark = M('#2b3036', { roughness: 0.6 }), steel = M('#4a5058', { metalness: 0.55, roughness: 0.4 });
  const black = M('#151719', { roughness: 0.7 });
  const bodyGeo = profile([[-0.62, 0.28], [-0.62, 0.95], [-0.25, 1.12], [0.75, 1.12], [0.95, 1.0], [0.95, 0.28]], 1.12, 0.06);
  const cwGeo = profile([[0.78, 0.25], [0.78, 1.12], [1.05, 1.12], [1.28, 0.95], [1.32, 0.55], [1.22, 0.25]], 1.14, 0.07);
  function makeForklift(n) {
    const g = new T.Group();
    g.add(mesh(bodyGeo, yellow), mesh(cwGeo, dark));
    // operator compartment: seat, backrest, steering wheel and column
    const seat = mesh(new T.BoxGeometry(0.52, 0.12, 0.48), black); seat.position.set(0, 1.24, 0.42);
    const back = mesh(new T.BoxGeometry(0.52, 0.5, 0.1), black); back.position.set(0, 1.5, 0.66); back.rotation.x = -0.15;
    const col = mesh(new T.CylinderGeometry(0.035, 0.035, 0.55, 8), dark); col.position.set(0, 1.42, -0.12); col.rotation.x = -0.5;
    const sw = mesh(new T.TorusGeometry(0.15, 0.025, 8, 20), black); sw.position.set(0, 1.66, -0.02); sw.rotation.x = Math.PI / 2 - 0.5;
    g.add(seat, back, col, sw);
    // overhead guard: four tube posts and a slatted roof
    [[-0.5, -0.38], [0.5, -0.38], [-0.5, 0.95], [0.5, 0.95]].forEach(([x, z]) => { const p = mesh(new T.CylinderGeometry(0.035, 0.035, 1.25, 8), dark); p.position.set(x, 1.72, z); p.rotation.x = z < 0 ? 0.08 : -0.05; g.add(p); });
    const frame = mesh(new T.BoxGeometry(1.08, 0.06, 1.42), dark); frame.position.set(0, 2.34, 0.29);
    g.add(frame);
    for (let k = 0; k < 5; k++) { const sl = mesh(new T.BoxGeometry(1.0, 0.03, 0.06), dark); sl.position.set(0, 2.37, -0.25 + k * 0.27); g.add(sl); }
    // wheels: large drive wheels at the front, smaller steer wheels at the back
    [[-0.56, -0.32, 0.31], [0.56, -0.32, 0.31], [-0.5, 1.02, 0.24], [0.5, 1.02, 0.24]].forEach(([x, z, r]) => { const w = wheel(r, 0.24); w.position.set(x, r, z); g.add(w); });
    // lights
    const lamp = M('#fffbe8', { emissive: '#fff4cc', emissiveIntensity: 0.9 }), tail = M('#ff3b30', { emissive: '#ff2a1a', emissiveIntensity: 0.6 });
    [-0.42, 0.42].forEach((x) => { const h = mesh(new T.BoxGeometry(0.13, 0.08, 0.04), lamp); h.position.set(x, 2.25, -0.42); g.add(h); const t = mesh(new T.BoxGeometry(0.1, 0.08, 0.04), tail); t.position.set(x * 1.1, 1.0, 1.31); g.add(t); });
    // mast: two outer channels with a cross head, inner rails that extend, chains
    [-0.4, 0.4].forEach((x) => { const ch = mesh(new T.BoxGeometry(0.1, 2.35, 0.14), steel); ch.position.set(x, 1.27, -0.74); g.add(ch); });
    const head = mesh(new T.BoxGeometry(0.92, 0.1, 0.14), steel); head.position.set(0, 2.42, -0.74); g.add(head);
    const inner = new T.Group(); inner.position.set(0, 1.25, -0.84);
    [-0.3, 0.3].forEach((x) => { const r = mesh(new T.BoxGeometry(0.08, 1, 0.1), M('#5d6570', { metalness: 0.55, roughness: 0.35 })); r.position.x = x; inner.add(r); const c = mesh(new T.CylinderGeometry(0.015, 0.015, 1, 6), M('#1a1a1a', { metalness: 0.7 })); c.position.set(x * 0.6, 0, -0.06); inner.add(c); });
    // carriage with load backrest and tapered forks
    const car = new T.Group(); car.position.set(0, 0.12, -0.88);
    const plate = mesh(new T.BoxGeometry(0.98, 0.42, 0.06), dark); plate.position.set(0, 0.22, 0); car.add(plate);
    for (let k = 0; k < 5; k++) { const bar = mesh(new T.BoxGeometry(0.03, 0.55, 0.03), dark); bar.position.set(-0.44 + k * 0.22, 0.7, 0.01); car.add(bar); }
    const top = mesh(new T.BoxGeometry(0.98, 0.04, 0.04), dark); top.position.set(0, 0.97, 0.01); car.add(top);
    const forkGeo = new T.BoxGeometry(0.12, 0.05, 1.1); forkGeo.translate(0, 0, -0.55);
    [-0.28, 0.28].forEach((x) => { const f = mesh(forkGeo, M('#30353b', { metalness: 0.5, roughness: 0.45 })); f.position.set(x, 0.03, 0); car.add(f); const sh = mesh(new T.BoxGeometry(0.12, 0.4, 0.05), M('#30353b', { metalness: 0.5 })); sh.position.set(x, 0.22, 0.02); car.add(sh); });
    g.add(inner, car);
    // fleet number on a plate above the guard, and on both sides
    const num = W.makeLabel(String(n), { size: 0.7, bg: '#1a1300', fg: '#f2b31b', weight: 700, depthTest: true });
    num.position.set(0, 2.9, 0.3); g.add(num);
    g.userData = { car, inner };
    return g;
  }

  // ---------- tractor-trailer: cab at -z, trailer rear at z = 0 (backs onto the dock) ----------
  const white = M('#f1f3f5', { roughness: 0.35, metalness: 0.2 }), glass = M('#1d2833', { metalness: 0.7, roughness: 0.12 }), chrome = M('#c7ccd1', { metalness: 0.85, roughness: 0.2 });
  const cabGeo = profile([[-15.1, 0.95], [-15.15, 1.9], [-14.95, 3.25], [-14.6, 3.55], [-12.7, 3.55], [-12.6, 0.95]], 2.45, 0.08);
  function makeTruck(dir) {
    const g = new T.Group(), accent = M(dir === 'in' ? '#2b5c9c' : '#d08a12', { roughness: 0.4, metalness: 0.2 });
    // cab with sloped windscreen, side windows, grille, bumper, lamps and mirrors
    g.add(mesh(cabGeo, white));
    const ws = mesh(new T.PlaneGeometry(2.2, 0.95), glass); ws.position.set(0, 2.85, -15.06); ws.rotation.x = 0.17; ws.rotation.y = Math.PI; g.add(ws);
    [-1.24, 1.24].forEach((x) => { const sw = mesh(new T.PlaneGeometry(0.9, 0.7), glass); sw.position.set(x, 2.8, -14.35); sw.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sw);
      const arm = mesh(new T.BoxGeometry(0.35, 0.04, 0.04), chrome); arm.position.set(x * 1.12, 2.7, -14.85); g.add(arm);
      const mir = mesh(new T.BoxGeometry(0.06, 0.45, 0.22), black); mir.position.set(x * 1.26, 2.7, -14.85); g.add(mir); });
    const grille = mesh(new T.BoxGeometry(1.4, 0.75, 0.06), M('#2b2f34', { metalness: 0.5 })); grille.position.set(0, 1.6, -15.2); g.add(grille);
    const bump = mesh(new T.BoxGeometry(2.45, 0.32, 0.25), M('#3a3f45', { metalness: 0.4 })); bump.position.set(0, 0.95, -15.18); g.add(bump);
    const hl = M('#fffbe8', { emissive: '#fff4cc', emissiveIntensity: 0.8 });
    [-0.95, 0.95].forEach((x) => { const h = mesh(new T.BoxGeometry(0.35, 0.16, 0.05), hl); h.position.set(x, 1.3, -15.22); g.add(h); });
    const stripeCab = mesh(new T.BoxGeometry(2.47, 0.18, 2.2), accent); stripeCab.position.set(0, 1.55, -13.8); g.add(stripeCab);
    [-1.05, 1.05].forEach((x) => { const tank = mesh(new T.CylinderGeometry(0.28, 0.28, 1.1, 14), chrome); tank.rotation.x = Math.PI / 2; tank.position.set(x, 0.85, -12.1); g.add(tank); });
    const chassis = mesh(new T.BoxGeometry(1.0, 0.25, 4.2), M('#25292e')); chassis.position.set(0, 0.75, -12.9); g.add(chassis);
    // trailer box with side ribs, frame, rear doors and tail lights
    const box = mesh(new T.BoxGeometry(2.5, 2.75, 12.2), white); box.position.set(0, 2.55, -6.1); g.add(box);
    const ribs = new T.InstancedMesh(new T.BoxGeometry(2.54, 2.7, 0.06), M('#d5dade', { roughness: 0.4, metalness: 0.25 }), 26);
    const m4 = new T.Matrix4(); for (let k = 0; k < 26; k++) { m4.makeTranslation(0, 2.55, -0.2 - k * 0.47); ribs.setMatrixAt(k, m4); }
    ribs.castShadow = true; g.add(ribs);
    const stripe = mesh(new T.BoxGeometry(2.56, 0.32, 12.2), accent); stripe.position.set(0, 1.55, -6.1); g.add(stripe);
    const frame = mesh(new T.BoxGeometry(2.3, 0.22, 12), M('#25292e')); frame.position.set(0, 1.05, -6); g.add(frame);
    const doors = mesh(new T.BoxGeometry(2.46, 2.65, 0.05), M('#e2e6ea', { roughness: 0.35, metalness: 0.3 })); doors.position.set(0, 2.55, 0.02); g.add(doors);
    const seam = mesh(new T.BoxGeometry(0.03, 2.65, 0.06), M('#9aa3ab')); seam.position.set(0, 2.55, 0.03); g.add(seam);
    const tail = M('#ff3b30', { emissive: '#ff2a1a', emissiveIntensity: 0.7 });
    [-1.05, 1.05].forEach((x) => { const t = mesh(new T.BoxGeometry(0.25, 0.12, 0.05), tail); t.position.set(x, 1.15, 0.05); g.add(t); const flap = mesh(new T.BoxGeometry(0.5, 0.45, 0.02), black); flap.position.set(x, 0.35, -0.9); g.add(flap); });
    [-1.0, 1.0].forEach((x) => { const leg = mesh(new T.BoxGeometry(0.1, 0.9, 0.1), M('#3a3f45')); leg.position.set(x, 0.55, -9.6); g.add(leg); });
    // wheels: tractor steer axle and drive axle, trailer tandem with twin tyres
    [[-13.9, 1], [-12.0, 2], [-2.1, 2], [-3.4, 2]].forEach(([z, twin]) => [-1, 1].forEach((side) => { for (let k = 0; k < twin; k++) { const w = wheel(0.5, 0.3, '#b9bec4'); w.position.set(side * (0.95 - k * 0.32), 0.5, z); g.add(w); } }));
    return g;
  }

  W.makeForklift = makeForklift;
  W.makeTruck = makeTruck;
})();
