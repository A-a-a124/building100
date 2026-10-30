/* Building 100 - forklift 3D model (body, mast, forks, number), used by the simulation */
(function () {
  const B = window.B100, T = THREE, W = B.world;
  function makeForklift(n) {
    const g = new T.Group();
    const body = W.box(1.15, 0.9, 1.9, '#f2b31b', { roughness: 0.5 });
    body.position.set(0, 0.7, 0.25);
    const cw = W.box(1.15, 0.7, 0.45, '#2f3439');
    cw.position.set(0, 0.85, 1.15);
    const seat = W.box(0.6, 0.35, 0.5, '#2f3439');
    seat.position.set(0, 1.3, 0.55);
    g.add(body, cw, seat);
    [[-0.5, -0.45], [0.5, -0.45], [-0.5, 1.05], [0.5, 1.05]].forEach(([x, z]) => {
      const p = W.box(0.06, 1.2, 0.06, '#2f3439');
      p.position.set(x * 0.95, 1.75, z);
      g.add(p);
    });
    const roof = W.box(1.1, 0.06, 1.6, '#2f3439');
    roof.position.set(0, 2.35, 0.3);
    g.add(roof);
    const wheelGeo = new T.CylinderGeometry(0.3, 0.3, 0.25, 14);
    [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.95], [0.55, 0.95]].forEach(([x, z]) => {
      const w = new T.Mesh(wheelGeo, W.mat('#1c1f22'));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.3, z);
      g.add(w);
    });
    const mast = W.box(0.9, 2.3, 0.1, '#3d434a', { metalness: 0.4 });
    mast.position.set(0, 1.25, -0.75);
    const inner = W.box(0.7, 1, 0.08, '#555d66', { metalness: 0.4 });
    inner.position.set(0, 1.25, -0.82);
    const car = new T.Group();
    const plate = W.box(0.95, 0.5, 0.06, '#2f3439');
    plate.position.set(0, 0.25, 0);
    const f1 = W.box(0.12, 0.05, 1.1, '#2f3439');
    f1.position.set(-0.28, 0.03, -0.55);
    const f2 = f1.clone();
    f2.position.x = 0.28;
    car.add(plate, f1, f2);
    car.position.set(0, 0.12, -0.88);
    g.add(mast, inner, car);
    const num = W.makeLabel(String(n), { size: 0.7, bg: '#1a1300', fg: '#f2b31b', weight: 700, depthTest: true });
    num.position.set(0, 2.9, 0.3);
    g.add(num);
    g.userData = { car, inner };
    return g;
  }
  W.makeForklift = makeForklift;
})();
