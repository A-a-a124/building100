/* Building 100 - first-person walk mode (keyboard, mouse, touch) and a VR viewer for WebXR headsets */
(function () {
  const B = window.B100, T = THREE, R = B.RACK;
  const { renderer, camera, controls, stage, scene } = B.three;
  const Wk = (B.walk = { active: false });
  const keys = {};
  let yaw = -Math.PI / 2, pitch = 0, touchMove = 0, touchTurn = 0;
  const START = { x: -30, z: -25.6 };

  // obstacles people cannot walk through: rack rows, shelving runs and the office
  const rects = [];
  R.rows.forEach((row) => rects.push([R.x0 - 0.2, R.x0 + R.bays * R.bayW + 0.2, row.z - 0.75, row.z + 0.75]));
  const sh = B.zoneById('SHELF');
  for (let k = 0; k < 6; k++) { const x = sh.x[0] + 2 + k * 3.4; rects.push([x - 0.45, x + 0.45, sh.z[0] + 1.5, sh.z[1] - 2.5]); }
  const off = B.zoneById('OFF');
  rects.push([off.x[0], off.x[1], off.z[0], off.z[1]]);
  const free = (x, z) => x > -68.6 && x < 118 && z > -46 && z < 46 && !rects.some((r) => x > r[0] && x < r[1] && z > r[2] && z < r[3]);

  // ---------- UI ----------
  const hint = document.createElement('div');
  hint.className = 'tour';
  hint.hidden = true;
  hint.innerHTML = '<div class="row"><span class="step">WALK MODE</span><button class="chip" id="walkExit">Exit walk mode</button></div>' +
    '<p id="walkHelp">Arrow keys or W A S D to walk, Shift to run. Click the view, then move the mouse to look around. Esc to exit.</p>' +
    '<div class="row" id="walkPad" style="justify-content:center;gap:10px"><button class="btn" data-m="1">Forward</button><button class="btn" data-t="1">Turn left</button><button class="btn" data-t="-1">Turn right</button><button class="btn" data-m="-1">Backward</button></div>';
  stage.appendChild(hint);
  const views = document.getElementById('views');
  views.insertAdjacentHTML('beforeend', '<button class="vbtn" id="walkBtn" aria-pressed="false">Walk mode</button><button class="vbtn" id="vrBtn" hidden>Enter VR</button>');
  const touchy = matchMedia('(pointer: coarse)').matches;
  document.getElementById('walkPad').hidden = !touchy;

  function enter() {
    if (Wk.active) return;
    Wk.active = true;
    B.ui.stopFollow();
    controls.enabled = false;
    camera.rotation.order = 'YXZ';
    if (!free(camera.position.x, camera.position.z) || camera.position.y > 3) { camera.position.set(START.x, 1.7, START.z); yaw = -Math.PI / 2; pitch = 0; }
    camera.position.y = 1.7;
    hint.hidden = false;
    B.world.labels.visible = false; // zone signs are too big at eye level
    document.getElementById('walkBtn').setAttribute('aria-pressed', 'true');
    B.tools.toast('Walk mode: arrow keys or W A S D to move, the mouse to look around');
  }
  function exit() {
    if (!Wk.active || Wk.xr) return;
    Wk.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    controls.enabled = true;
    camera.rotation.order = 'XYZ';
    const ahead = new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(6).add(camera.position);
    controls.target.copy(ahead);
    hint.hidden = true;
    B.world.labels.visible = document.getElementById('lyLabels').checked;
    B.actors.showTags(true);
    document.getElementById('walkBtn').setAttribute('aria-pressed', 'false');
    B.ui.setView('overview');
  }
  document.getElementById('walkBtn').addEventListener('click', () => (Wk.active ? exit() : enter()));
  document.getElementById('walkExit').addEventListener('click', exit);
  addEventListener('keydown', (e) => {
    if (!Wk.active || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    keys[e.code] = true;
    if (e.code === 'Escape' && !document.pointerLockElement) exit();
    if (/Arrow/.test(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  renderer.domElement.addEventListener('click', () => { if (Wk.active && !touchy && !document.pointerLockElement) { try { renderer.domElement.requestPointerLock(); } catch (e) {} } });
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { if (Wk.active && !document.pointerLockElement) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => (drag = null));
  addEventListener('pointermove', (e) => {
    if (!Wk.active) return;
    let dx = 0, dy = 0;
    if (document.pointerLockElement === renderer.domElement) { dx = e.movementX; dy = e.movementY; }
    else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; }
    yaw -= dx * 0.0028; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.0028));
  });
  hint.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-m],[data-t]'); if (!b) return; touchMove = +b.dataset.m || 0; touchTurn = +b.dataset.t || 0; });
  addEventListener('pointerup', () => { touchMove = 0; touchTurn = 0; });

  B.hooks.frame.push((dt) => {
    if (!Wk.active || Wk.xr) return;
    const run = keys.ShiftLeft || keys.ShiftRight ? 4 : 1.6;
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touchMove;
    let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0) + touchTurn) * dt * 1.6;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    const nx = camera.position.x + (fx * f + rx * s) * run * dt, nz = camera.position.z + (fz * f + rz * s) * run * dt;
    if (free(nx, camera.position.z)) camera.position.x = nx;
    if (free(camera.position.x, nz)) camera.position.z = nz;
    camera.position.y = 1.7 + (f || s ? Math.sin(performance.now() / 160) * 0.025 : 0);
    camera.rotation.set(pitch, yaw, 0);
    // name tags of people right next to you would fill the screen
    B.actors.list.forEach((a) => { const t = a.mesh.userData.tag; if (t) t.visible = Math.hypot(a.x - camera.position.x, a.z - camera.position.z) > 4; });
  });

  // ---------- VR ----------
  const SPOTS = [[-30, -25.6, -Math.PI / 2], [-34, -16.2, -Math.PI / 2], [6, -24, Math.PI], [60, 4, -Math.PI / 2], [6, 26, 0]];
  const dolly = new T.Group();
  scene.add(dolly);
  let spot = 0;
  function placeDolly() { const [x, z, r] = SPOTS[spot]; dolly.position.set(x, 0, z); dolly.rotation.y = r; }
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
      if (!ok) return;
      const vb = document.getElementById('vrBtn');
      vb.hidden = false;
      vb.addEventListener('click', async () => {
        try {
          const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
          renderer.xr.enabled = true;
          Wk.active = true; Wk.xr = true; controls.enabled = false;
          dolly.add(camera); camera.position.set(0, 0, 0); spot = 0; placeDolly();
          const ctl = renderer.xr.getController(0);
          ctl.addEventListener('select', () => { spot = (spot + 1) % SPOTS.length; placeDolly(); });
          dolly.add(ctl);
          session.addEventListener('end', () => {
            renderer.xr.enabled = false; Wk.xr = false; Wk.active = false; controls.enabled = true;
            scene.add(camera); B.ui.setView('overview');
          });
          await renderer.xr.setSession(session);
        } catch (e) { B.tools.toast('Could not start VR: ' + e.message, 5000); }
      });
    }).catch(() => {});
  }
})();
