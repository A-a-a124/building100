/* Building 100 - drive a forklift yourself: chase camera, W/S to drive, A/D to steer, Q/E for the forks, Space to pick up or set down */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const { camera, controls, stage } = B.three;
  const RACK = B.RACK, BLD = B.BUILDING;
  const keys = {};
  let f = null, v = 0, demo = null, goal = null, carried = false, t0 = 0;
  const D = { active: false, delivered: false, best: null };

  // places a forklift cannot drive into: rack rows, shelving, hazmat cage, office, pipe racks
  const blocks = [];
  RACK.rows.forEach((r) => blocks.push([RACK.x0 - 0.3, r.z - RACK.depth / 2 - 0.3, RACK.x0 + RACK.bays * RACK.bayW + 0.3, r.z + RACK.depth / 2 + 0.3]));
  ['SHELF', 'HAZ', 'OFF', 'PIPE'].forEach((id) => { const z = B.zoneById(id); blocks.push([z.x[0], z.z[0], z.x[1], z.z[1]]); });
  const free = (x, z) => x > BLD.x0 + 1.5 && x < BLD.x1 - 1.5 && z > BLD.z0 + 1.5 && z < BLD.z1 - 1.5 && !blocks.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);

  const hud = document.createElement('div');
  hud.className = 'drivehud'; hud.hidden = true;
  hud.innerHTML = '<b>Driving forklift <span id="dvN"></span></b><span id="dvInfo"></span><small>W / S drive · A / D steer · Q / E forks up / down · Space pick up or set down · Esc stop</small><div class="btnrow"><button class="btn" id="dvStop">Stop driving</button></div>';
  stage.appendChild(hud);
  const css = document.createElement('style');
  css.textContent = `.drivehud { position: absolute; z-index: 6; left: 50%; bottom: 14px; transform: translateX(-50%); background: rgba(12,17,23,0.88); color: #fff; border-radius: 12px; padding: 10px 14px; display: grid; gap: 4px; text-align: center; box-shadow: var(--shadow); max-width: calc(100% - 32px); }
    .drivehud b { font: 700 15px var(--f-display); } .drivehud span { font: 600 13px var(--f-mono); color: #f2b31b; } .drivehud small { color: #c9d1d8; } .drivehud .btnrow { justify-content: center; } .drivehud .btn { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }`;
  document.head.appendChild(css);

  function start() {
    if (D.active) return;
    f = S.forklifts.find((q) => q.phase === 'idle' && !q.task && !q.down) || S.forklifts.find((q) => !q.task && !q.down) || S.forklifts.find((q) => q.phase === 'charging');
    if (!f) return B.tools.toast('Every forklift is busy right now. Try again in a moment.');
    D.active = true; D.delivered = false; carried = false; v = 0;
    f.prevPhase = f.phase; f.phase = 'manual'; f.path = []; f.head = Math.PI; // face into the warehouse
    controls.enabled = false;
    // a practice pallet near the chargers and a green drop square by the shipping lane
    const lane = B.LANES;
    demo = W.makePallet(B.ITEMS[0] ? 0 : 0); demo.position.set(f.x + 4, 0, lane.front + 0.2); W.scene.add(demo);
    goal = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ color: '#2fbf5a', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    goal.rotation.x = -Math.PI / 2; goal.position.set(lane.west, 0.06, lane.back); W.scene.add(goal);
    hud.hidden = false; document.getElementById('dvN').textContent = f.n;
    t0 = performance.now();
    B.tools.toast('Pick up the pallet in front of you and bring it to the green square');
    const d = document.querySelector('.drawer'); if (d && !d.hidden) document.getElementById('drawerClose').click();
  }
  function stop() {
    if (!D.active) return;
    D.active = false; controls.enabled = true; hud.hidden = true;
    if (demo) { (demo.parent || W.scene).remove(demo); demo = null; }
    if (goal) { W.scene.remove(goal); goal = null; }
    Object.assign(f, { x: f.home.x, z: f.home.z, at: f.home, carY: 0.12, head: 0, phase: 'idle' });
    f = null;
    B.ui.setView('overview');
  }
  function toggleLoad() {
    const car = f.mesh.userData.car;
    if (!carried) {
      const fx = f.x - Math.sin(f.head) * 1.6, fz = f.z - Math.cos(f.head) * 1.6;
      if (!demo || Math.hypot(demo.position.x - fx, demo.position.z - fz) > 1.4) return B.tools.toast('Drive the forks under the pallet first');
      if (f.carY > 0.5) return B.tools.toast('Lower the forks (E) to pick up');
      W.scene.remove(demo); car.add(demo); demo.position.set(0, 0.02, -0.55); demo.rotation.set(0, 0, 0); carried = true;
    } else {
      const p = new T.Vector3(); demo.getWorldPosition(p);
      car.remove(demo); W.scene.add(demo); demo.position.set(p.x, 0, p.z); demo.rotation.y = f.head; carried = false;
      if (goal && Math.hypot(p.x - goal.position.x, p.z - goal.position.z) < 1.8) {
        const s = (performance.now() - t0) / 1000;
        D.delivered = true; D.best = D.best == null ? s : Math.min(D.best, s);
        B.tools.toast('Delivered in ' + Math.round(s) + ' s. Nice driving!', 5000);
        goal.material.color.set('#f2b31b');
      }
    }
  }
  addEventListener('keydown', (e) => {
    if (!D.active) return;
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { keys[e.code] = true; e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); toggleLoad(); }
    if (e.code === 'Escape') stop();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  document.getElementById('dvStop').addEventListener('click', stop);

  const camPos = new T.Vector3(), camTgt = new T.Vector3();
  B.hooks.frame.push((dt) => {
    if (!D.active || !f) return;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    v += (fwd * (fwd > 0 ? 3.5 : 1.6) - v) * Math.min(1, dt * 2.5);
    if (Math.abs(v) > 0.05) f.head += steer * dt * 1.6 * Math.sign(v) * Math.min(1, Math.abs(v) / 1.5);
    const nx = f.x - Math.sin(f.head) * v * dt, nz = f.z - Math.cos(f.head) * v * dt;
    if (free(nx, nz)) { f.x = nx; f.z = nz; } else v = 0;
    if (keys.KeyQ) f.carY = Math.min(5.5, f.carY + dt * 0.8);
    if (keys.KeyE) f.carY = Math.max(0.12, f.carY - dt * 0.8);
    // the simulation only draws a forklift in an unknown phase, so position it directly
    f.mesh.position.set(f.x, 0, f.z); f.mesh.rotation.y = f.head;
    f.mesh.userData.car.position.y = f.carY;
    const back = new T.Vector3(Math.sin(f.head), 0, Math.cos(f.head));
    camPos.set(f.x + back.x * 7, 4.2, f.z + back.z * 7); camTgt.set(f.x - back.x * 3, 1.2, f.z - back.z * 3);
    camera.position.lerp(camPos, Math.min(1, dt * 4)); controls.target.lerp(camTgt, Math.min(1, dt * 4)); camera.lookAt(controls.target);
    document.getElementById('dvInfo').textContent = fmt(Math.abs(v) * 3.6) + ' km/h · forks ' + f.carY.toFixed(1) + ' m · ' + (carried ? 'carrying the pallet' : D.delivered ? 'delivered' : 'no load');
  });
  const fmt = (n) => Math.round(n);

  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vDrive" title="Drive a forklift with the keyboard">Drive a forklift</button>');
  document.getElementById('vDrive').addEventListener('click', () => (D.active ? stop() : start()));
  Object.assign(D, { start, stop });
  B.drive = D;
})();
