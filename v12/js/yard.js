/* Building 100 - open storage yard beside the warehouse */
(function () {
  const B = window.B100;
  const T = THREE;
  const W = B.world;
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), C = new T.Color();
  const Y = new T.Vector3(0, 1, 0), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);

  function inst(geo, mat, n) {
    const m = new T.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.pick = { type: 'zone', id: 'YARD' };
    W.pickables.push(m);
    return m;
  }

  W.buildYard = function (scene) {
    const zn = B.zoneById('YARD');
    const g = new T.Group();
    const [x0, x1] = zn.x, [z0, z1] = zn.z;

    // gravel pad and perimeter fence with a gate facing the warehouse
    const pad = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), W.mat('#8d8475', { roughness: 1 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2);
    pad.receiveShadow = true;
    g.add(pad);
    const fence = new T.MeshStandardMaterial({ color: '#9aa6b2', transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false });
    const runs = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z1, x1, z1], [x0, z0, x0, -5], [x0, 5, x0, z1]];
    runs.forEach(([a, b, c, d]) => {
      const len = Math.hypot(c - a, d - b);
      const p = new T.Mesh(new T.PlaneGeometry(len, 2.4), fence);
      p.position.set((a + c) / 2, 1.2, (b + d) / 2);
      p.rotation.y = -Math.atan2(d - b, c - a);
      g.add(p);
      const n = Math.ceil(len / 3);
      for (let k = 0; k <= n; k++) {
        const post = W.box(0.09, 2.5, 0.09, '#6b7680');
        post.position.set(a + ((c - a) * k) / n, 1.25, b + ((d - b) * k) / n);
        g.add(post);
      }
    });

    // pipe stacks on timber sleepers: three rows of nine bundles
    const sleepers = inst(new T.BoxGeometry(0.25, 0.25, 4.6), W.mat('#7a5a3a'), 3 * 9 * 3);
    const pipes = inst(new T.CylinderGeometry(1, 1, 12, 16), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.45 }), 3 * 9 * 10);
    const pipeCols = ['#5b4a3c', '#3d6d8c', '#6e6e6e'];
    let si = 0, pi = 0;
    for (let r = 0; r < 3; r++) {
      for (let b = 0; b < 9; b++) {
        const cx = x0 + 6 + r * 13.5, cz = z0 + 4 + b * 3.9;
        [-4.5, 0, 4.5].forEach((dx) => { M4.compose(V.set(cx + dx, 0.13, cz), Q.identity(), S.set(1, 1, 1)); sleepers.setMatrixAt(si++, M4); });
        const rad = 0.2;
        for (let k = 0; k < 10; k++) {
          const row = k < 4 ? 0 : k < 7 ? 1 : k < 9 ? 2 : 3, inRow = k < 4 ? k : k < 7 ? k - 4 : k < 9 ? k - 7 : 0;
          const n = 4 - row;
          Q.setFromAxisAngle(Z, Math.PI / 2);
          M4.compose(V.set(cx, 0.26 + rad + row * rad * 1.75, cz - (n - 1) * rad + inRow * rad * 2), Q, S.set(rad, 1, rad));
          pipes.setMatrixAt(pi, M4);
          pipes.setColorAt(pi++, C.set(pipeCols[r]));
        }
      }
    }
    g.add(sleepers, pipes);

    // cable drums lying in a line
    const drums = inst(new T.CylinderGeometry(1.1, 1.1, 0.9, 22), W.mat('#a0703f'), 20);
    for (let k = 0; k < 20; k++) {
      Q.setFromAxisAngle(X, Math.PI / 2);
      M4.compose(V.set(x1 - 3, 1.1, z0 + 3 + k * 2.2), Q, S.set(1, 1, 1));
      drums.setMatrixAt(k, M4);
    }
    g.add(drums);

    // steel section stacks
    const steel = inst(new T.BoxGeometry(12, 0.3, 0.3), W.mat('#7d8790', { metalness: 0.6, roughness: 0.4 }), 4 * 18);
    let ki = 0;
    for (let st = 0; st < 4; st++) {
      for (let k = 0; k < 18; k++) {
        M4.compose(V.set(x0 + 9 + (st % 2) * 14, 0.2 + Math.floor(k / 6) * 0.32, z1 - 8 + Math.floor(st / 2) * -5 + (k % 6) * 0.34), Q.identity(), S.set(1, 1, 1));
        steel.setMatrixAt(ki++, M4);
      }
    }
    g.add(steel);

    // container line along the far fence
    const cont = inst(new T.BoxGeometry(2.44, 2.59, 6.06), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.3 }), 12);
    const cc = ['#b5442f', '#2f6db5', '#2f8f5b', '#c58d1f', '#7a7f86', '#b5442f'];
    for (let k = 0; k < 12; k++) {
      const stack = k >= 8 ? 1 : 0, col = stack ? k - 8 : k;
      M4.compose(V.set(x1 - 9, 1.3 + stack * 2.6, z1 - 4 - col * 6.6 - (stack ? 6.6 : 0)), Q.setFromAxisAngle(Y, 0), S.set(1, 1, 1));
      cont.setMatrixAt(k, M4);
      cont.setColorAt(k, C.set(cc[k % cc.length]));
    }
    g.add(cont);

    // light masts
    [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]].forEach(([x, z]) => {
      const m = W.box(0.25, 14, 0.25, '#5d6873');
      m.position.set(x, 7, z);
      const head = W.box(1.6, 0.4, 0.6, '#e9eef2', { emissive: '#fff4d6', emissiveIntensity: 0.6 });
      head.position.set(x, 14, z);
      g.add(m, head);
    });
    scene.add(g);
    W.yardGroup = g;
  };
})();
