/* Building 19 - motion: forklifts, trucks and people ease in and out and turn through arcs; a soft contact shadow under everything that stands on the floor */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors;
  const { scene, hemi } = B.three;
  const { canvas } = B.loads;
  const seen = new WeakMap();
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  // The simulation moves things at a constant speed and stops them dead. What is drawn follows that position with a little lag,
  // which gives acceleration, braking and rounded corners without changing any of the simulation's own numbers.
  function chase(key, mesh, dt, tau) {
    let v = seen.get(key);
    const tx = mesh.position.x, tz = mesh.position.z;
    if (!v) { v = { x: tx, z: tz, h: mesh.rotation.y, vx: 0, vz: 0, roll: 0 }; seen.set(key, v); }
    if (dt <= 0 || Math.hypot(tx - v.x, tz - v.z) > 7) { v.x = tx; v.z = tz; v.h = mesh.rotation.y; v.vx = v.vz = 0; return null; }
    const k = 1 - Math.exp(-dt / tau), nx = v.x + (tx - v.x) * k, nz = v.z + (tz - v.z) * k;
    v.vx = (nx - v.x) / dt; v.vz = (nz - v.z) / dt; v.x = nx; v.z = nz;
    mesh.position.x = nx; mesh.position.z = nz;
    return v;
  }

  // ---------- contact shadows: one instanced mesh for every forklift, truck and person ----------
  const blobTex = canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 3, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const blobMat = new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const MAX = 80, blobs = new T.InstancedMesh(new T.PlaneGeometry(1, 1), blobMat, MAX);
  blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);
  const M = new T.Matrix4(), Q = new T.Quaternion(), QF = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2), Y = new T.Vector3(0, 1, 0), P = new T.Vector3(), SC = new T.Vector3();
  let n = 0;
  function blob(x, z, yaw, w, l) {
    if (n >= MAX) return;
    Q.setFromAxisAngle(Y, yaw).multiply(QF);
    M.compose(P.set(x, 0.046, z), Q, SC.set(w, l, 1));
    blobs.setMatrixAt(n++, M);
  }

  B.hooks.frame.push((dt) => {
    const run = S.st.running && !(B.timeline && B.timeline.active());
    const sdt = run ? dt * S.st.speed : 0, adt = run ? dt * (S.st.speed >= 20 ? 2 : 1) : 0;
    n = 0;
    S.forklifts.forEach((f) => {
      const m = f.mesh;
      if (f.phase !== 'manual') {
        const v = chase(f, m, sdt, 0.34);
        if (v) {
          // the nose follows the direction of travel; standing still it turns to face the rack
          const sp = Math.hypot(v.vx, v.vz), want = sp > 0.5 ? Math.atan2(-v.vx, -v.vz) : f.head;
          const max = 3.2 * sdt, step = Math.max(-max, Math.min(max, wrap(want - v.h) * (1 - Math.exp(-sdt / 0.18))));
          v.h += step; m.rotation.y = v.h;
          v.roll += (Math.max(-0.028, Math.min(0.028, (-step / sdt) * 0.014 * Math.min(1, sp / 2))) - v.roll) * Math.min(1, sdt * 5);
          m.rotation.z = v.roll;
        }
      }
      blob(m.position.x, m.position.z, m.rotation.y, 2.3, 3.7);
    });
    S.trucks.forEach((tr) => {
      const m = tr.mesh;
      chase(tr, m, sdt, 0.9);
      if (!m.visible || !m.parent) return;
      const fz = m.rotation.y ? 7.6 : -7.6; // the cab leads: the middle of the rig is 7.6 m ahead of the tail
      blob(m.position.x, m.position.z + fz, 0, 3.9, 18.5);
    });
    A.list.forEach((a) => {
      if (a.kind !== 'person') return;
      chase(a, a.mesh, adt, 0.2);
      if (a.mesh.visible) blob(a.mesh.position.x, a.mesh.position.z, 0, 1.05, 1.05);
    });
    if (B.dockwork) B.dockwork.list.forEach((q) => { const m = q.mesh; if (m.visible && m.position.y < 0.3) blob(m.position.x, m.position.z, m.rotation.y, 2.3, 3.7); });
    blobs.count = n; blobs.instanceMatrix.needsUpdate = true;
    // softer in the dark, when there is little light for a shadow to block
    blobMat.opacity = 0.14 + 0.2 * Math.max(0, Math.min(1, (hemi.intensity - 0.1) / 0.3));
  });
  B.motion = { blobs, seen };
})();
