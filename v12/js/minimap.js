/* Building 100 - mini-map: plan of the site with live forklifts, people, drones and the camera; click to fly there */
(function () {
  const B = window.B100, S = B.sim, W = B.world;
  const { camera, controls, stage } = B.three;
  const X0 = -72, X1 = 120, Z0 = -44, Z1 = 44, CW = 240, CH = Math.round((CW * (Z1 - Z0)) / (X1 - X0));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  const box = document.createElement('div');
  box.className = 'mmap';
  box.innerHTML = '<button class="mmhead" aria-expanded="true"><span>Site map</span><b>–</b></button><canvas aria-label="Site map: click to move the camera there"></canvas>';
  stage.appendChild(box);
  const css = document.createElement('style');
  css.textContent = `.mmap { position: absolute; z-index: 3; right: 12px; top: 104px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
    .mmhead { display: flex; justify-content: space-between; align-items: center; width: 100%; border: 0; background: transparent; padding: 5px 10px; font: 600 12px var(--f-body, inherit); color: var(--muted); cursor: pointer; }
    .mmap canvas { display: block; width: ${CW}px; height: ${CH}px; cursor: crosshair; } .mmap.closed canvas { display: none; } body.cine .mmap { display: none; }`;
  document.head.appendChild(css);
  const head = box.querySelector('.mmhead'), cv = box.querySelector('canvas');
  const setOpen = (o) => { box.classList.toggle('closed', !o); head.setAttribute('aria-expanded', o); head.querySelector('b').textContent = o ? '–' : '+'; store.set('b100.map', o ? '1' : '0'); };
  setOpen(store.get('b100.map') ? store.get('b100.map') === '1' : innerWidth > 760);
  head.addEventListener('click', () => setOpen(box.classList.contains('closed')));

  const ratio = Math.min(devicePixelRatio || 1, 2);
  cv.width = CW * ratio; cv.height = CH * ratio;
  const ctx = cv.getContext('2d');
  const px = (x) => ((x - X0) / (X1 - X0)) * CW, pz = (z) => ((z - Z0) / (Z1 - Z0)) * CH;

  // static plan drawn once per theme
  let bg = null, bgKey = '';
  function background() {
    const cs = getComputedStyle(document.documentElement), key = cs.getPropertyValue('--surface');
    if (bg && key === bgKey) return bg;
    bgKey = key;
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const g = bg.getContext('2d'); g.scale(ratio, ratio);
    g.fillStyle = cs.getPropertyValue('--surface-2').trim() || '#eee'; g.fillRect(0, 0, CW, CH);
    const BLD = B.BUILDING;
    g.fillStyle = cs.getPropertyValue('--surface').trim() || '#fff'; g.strokeStyle = cs.getPropertyValue('--muted').trim(); g.lineWidth = 1;
    g.fillRect(px(BLD.x0), pz(BLD.z0), px(BLD.x1) - px(BLD.x0), pz(BLD.z1) - pz(BLD.z0)); g.strokeRect(px(BLD.x0), pz(BLD.z0), px(BLD.x1) - px(BLD.x0), pz(BLD.z1) - pz(BLD.z0));
    B.ZONES.forEach((zn) => { g.fillStyle = zn.color + '40'; g.fillRect(px(zn.x[0]), pz(zn.z[0]), px(zn.x[1]) - px(zn.x[0]), pz(zn.z[1]) - pz(zn.z[0])); });
    g.fillStyle = '#2b5c9c';
    B.RACK.rows.forEach((r) => g.fillRect(px(B.RACK.x0), pz(r.z) - 0.6, px(B.RACK.x0 + B.RACK.bays * B.RACK.bayW) - px(B.RACK.x0), 1.2));
    g.fillStyle = '#2c3238';
    W.doorsIn.concat(W.doorsOut).forEach((d) => g.fillRect(px(d.x) - 2, pz(d.z) - 1.5, 4, 3));
    return bg;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(background(), 0, 0);
    ctx.scale(ratio, ratio);
    const dot = (x, z, r, fill, ring) => { ctx.beginPath(); ctx.arc(px(x), pz(z), r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 1; ctx.stroke(); } };
    S.trucks.forEach((t) => { ctx.fillStyle = '#9aa3ab'; ctx.fillRect(px(t.door.x) - 2, pz(t.mesh.position.z) - 4, 4, 8); });
    B.actors.list.forEach((a) => (a.kind === 'drone' ? dot(a.x, a.z, 2.6, '#33c3ff', '#0b3d52') : dot(a.x, a.z, 2.2, '#ffffff', '#1a1a1a')));
    S.forklifts.forEach((f) => dot(f.x, f.z, 3, f.down ? '#e5372b' : '#f2b31b', '#1a1300'));
    // camera: where it stands and where it looks
    const t = controls.target, c = camera.position;
    ctx.strokeStyle = '#e5372b'; ctx.fillStyle = 'rgba(229,55,43,0.15)'; ctx.lineWidth = 1.5;
    const dx = t.x - c.x, dz = t.z - c.z, ang = Math.atan2(dz, dx), reach = Math.max(18, Math.hypot(dx, dz) * 1.2), half = (camera.fov * camera.aspect * Math.PI) / 360;
    ctx.beginPath(); ctx.moveTo(px(c.x), pz(c.z));
    ctx.lineTo(px(c.x + Math.cos(ang - half) * reach), pz(c.z + Math.sin(ang - half) * reach));
    ctx.lineTo(px(c.x + Math.cos(ang + half) * reach), pz(c.z + Math.sin(ang + half) * reach));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    dot(t.x, t.z, 2.4, '#e5372b');
  }

  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const x = X0 + ((e.clientX - r.left) / r.width) * (X1 - X0), z = Z0 + ((e.clientY - r.top) / r.height) * (Z1 - Z0);
    const off = camera.position.clone().sub(controls.target);
    B.ui.flyTo([x + off.x, camera.position.y, z + off.z], [x, 0, z], 1);
    document.querySelectorAll('.vbtn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  });

  let t = 0;
  B.hooks.frame.push((dt) => { if ((t += dt) < 0.12 || box.classList.contains('closed')) return; t = 0; draw(); });
})();
