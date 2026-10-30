/* Building 100 - dock detail: roller doors open when a truck backs on and close after it leaves; the dock leveller drops into the trailer; forklift trails */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const { scene } = B.three;

  // ribbed roller-door texture
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#5a6570'; g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y, 64, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y + 13, 64, 3); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  })();
  const doorMat = new T.MeshStandardMaterial({ map: tex, metalness: 0.45, roughness: 0.45 });
  const lipMat = W.mat('#c49a2c', { metalness: 0.5 });

  const doors = W.doorsIn.concat(W.doorsOut).map((d) => {
    // hide the flat door built with the shell, replace it with a door that rolls up
    scene.traverse((o) => {
      const p = o.geometry && o.geometry.parameters;
      if (o.isMesh && p && p.width === 3.6 && p.height === 4.2 && Math.abs(o.position.x - d.x) < 0.01 && Math.abs(o.position.z - d.z) < 0.5) o.visible = false;
    });
    const panel = new T.Mesh(new T.BoxGeometry(3.6, 4.2, 0.12), doorMat);
    panel.position.set(d.x, 2.1, d.z + d.dir * 0.1); panel.castShadow = true;
    const drum = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 3.8, 16), W.mat('#3b434b', { metalness: 0.6 }));
    drum.rotation.z = Math.PI / 2; drum.position.set(d.x, 4.45, d.z + d.dir * 0.25);
    const lip = new T.Mesh(new T.BoxGeometry(2.2, 0.06, 0.8), lipMat);
    lip.position.set(d.x, 0.08, d.z - d.dir * 0.3);
    scene.add(panel, drum, lip);
    return { d, panel, lip, open: 0 };
  });

  function wantsOpen(d) {
    return S.trucks.some((tr) => tr.door === d && (tr.phase === 'work' || (tr.phase === 'arrive' && Math.abs(tr.z - tr.dockZ) < 8) || (tr.phase === 'leave' && Math.abs(tr.z - tr.dockZ) < 3)));
  }

  // ---------- forklift trails: the last minute of driving, fading out ----------
  const N = 400, trails = new Map(), group = new T.Group(); group.visible = false; scene.add(group);
  const floor = new T.Color('#c4c6c8');
  function trail(f) {
    let tr = trails.get(f);
    if (tr) return tr;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(N * 3), 3));
    const hue = new T.Color().setHSL((f.n * 0.13) % 1, 0.85, 0.5);
    const line = new T.Line(geo, new T.LineBasicMaterial({ vertexColors: true, toneMapped: false }));
    line.frustumCulled = false; group.add(line);
    tr = { line, pts: [], hue }; trails.set(f, tr);
    return tr;
  }
  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyTrails">Forklift trails</label>');
  const box = document.getElementById('lyTrails');
  box.parentElement.hidden = !layers.querySelector('label:not([hidden])');
  box.addEventListener('change', () => (group.visible = box.checked));

  let t = 0;
  B.hooks.frame.push((dt) => {
    doors.forEach((q) => {
      const target = wantsOpen(q.d) ? 1 : 0;
      q.open += (target - q.open) * Math.min(1, dt * 2.2);
      const h = 4.2 * (1 - 0.9 * q.open);
      q.panel.scale.y = h / 4.2; q.panel.position.y = 4.2 - h / 2;
      q.lip.rotation.x = q.d.dir * -0.25 * q.open; q.lip.position.z = q.d.z - q.d.dir * (0.3 - 0.5 * q.open);
    });
    // sample by distance so the trail follows the lanes at any simulation speed
    S.forklifts.forEach((f) => {
      const tr = trail(f), k = tr.pts.length;
      if (k && Math.hypot(tr.pts[k - 3] - f.x, tr.pts[k - 1] - f.z) < 1.2) return;
      tr.pts.push(f.x, 0.09, f.z);
      if (tr.pts.length > N * 3) tr.pts.splice(0, 3);
      tr.dirty = true;
    });
    if ((t += dt) < 0.25) return;
    t = 0;
    S.forklifts.forEach((f) => {
      const tr = trail(f);
      if (!group.visible || !tr.dirty) return;
      tr.dirty = false;
      const pos = tr.line.geometry.attributes.position.array, col = tr.line.geometry.attributes.color.array, n = tr.pts.length / 3, c = new T.Color();
      for (let i = 0; i < n; i++) {
        pos[i * 3] = tr.pts[i * 3]; pos[i * 3 + 1] = tr.pts[i * 3 + 1]; pos[i * 3 + 2] = tr.pts[i * 3 + 2];
        c.copy(floor).lerp(tr.hue, i / n); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      tr.line.geometry.setDrawRange(0, n);
      tr.line.geometry.attributes.position.needsUpdate = true; tr.line.geometry.attributes.color.needsUpdate = true;
    });
    trails.forEach((tr, f) => { if (!S.forklifts.includes(f)) { group.remove(tr.line); trails.delete(f); } });
  });
  B.docks = { doors, trails: group };
})();
