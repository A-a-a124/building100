/* Building 19 - feel: labels that shrink as you come close, smooth zoom towards the pointer, double-click to fly to a spot */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors;
  const { renderer, camera, controls, stage } = B.three;

  // ---------- labels: full size from afar, never larger than a fixed share of the screen up close ----------
  const K = 0.03, wp = new T.Vector3();
  function fit(sp, drop) {
    if (!sp || !sp.visible) return;
    const u = sp.userData;
    if (!u.s0) { u.s0 = sp.scale.clone(); u.y0 = sp.position.y; }
    const d = sp.getWorldPosition(wp).distanceTo(camera.position), f = Math.min(1, Math.max(0.1, (K * d) / u.s0.y));
    sp.scale.set(u.s0.x * f, u.s0.y * f, 1);
    if (drop) sp.position.y = u.y0 - drop * (1 - f);
  }
  B.hooks.frame.push(() => {
    if (W.labels.visible) W.labels.children.forEach((sp) => fit(sp, 0));
    A.list.forEach((a) => fit(a.mesh.userData.tag, 0.3));
    S.trucks.forEach((tr) => fit(tr.mesh.userData.carrierTag, 0));
  });

  // ---------- pointer on the floor ----------
  const ray = new T.Raycaster(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0), v2 = new T.Vector2(), hit = new T.Vector3();
  function floorAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    return ray.ray.intersectPlane(floor, hit) && hit.distanceTo(camera.position) < 700 ? hit.clone() : null;
  }

  // ---------- zoom: each notch of the wheel glides, and the point under the pointer stays under it ----------
  let goal = 0;
  const pivot = new T.Vector3();
  stage.addEventListener('wheel', (e) => {
    if (e.target !== renderer.domElement || !controls.enabled) return;
    e.preventDefault(); e.stopPropagation();
    B.ui.stopFly();
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    goal += Math.max(-0.5, Math.min(0.5, -dy * 0.0012));
    pivot.copy(floorAt(e) || controls.target);
  }, { capture: true, passive: false });
  B.hooks.frame.push((dt) => {
    if (Math.abs(goal) < 1e-4 || !controls.enabled) { goal = 0; return; }
    const step = goal * (1 - Math.exp(-dt * 9)); goal -= step;
    const f = Math.exp(-step), d = camera.position.distanceTo(controls.target) * f, y = pivot.y + (camera.position.y - pivot.y) * f;
    if (d < controls.minDistance || d > controls.maxDistance || y < 0.7) { goal = 0; return; }
    camera.position.sub(pivot).multiplyScalar(f).add(pivot);
    controls.target.sub(pivot).multiplyScalar(f).add(pivot);
  });

  // ---------- double-click: fly to that spot, keeping the viewing angle ----------
  renderer.domElement.addEventListener('dblclick', (e) => {
    if (!controls.enabled) return;
    const p = floorAt(e); if (!p) return;
    const off = camera.position.clone().sub(controls.target);
    off.setLength(Math.max(12, Math.min(off.length(), 60) * 0.5));
    B.ui.flyTo([p.x + off.x, Math.max(2.5, off.y), p.z + off.z], [p.x, 1, p.z], 0.9);
  });
  B.feel = { fit, floorAt, zooming: () => Math.abs(goal) > 1e-4 };
})();
