/* Building 19 - people: jointed figures with knees, elbows and short sleeves. W.makeFigure(look) returns a group standing on y = 0 and facing +z */
(function () {
  const B = window.B100, T = THREE, W = B.world;
  B.hooks = B.hooks || { frame: [] };
  const figs = [];
  const part = (geo, color, o) => { const q = new T.Mesh(geo, W.mat(color, o)); q.castShadow = true; return q; };
  const soft = (q) => { q.castShadow = false; return q; }; // small parts leave the shadow to the body and legs
  // a tapered limb segment hanging down from its joint
  function seg(r0, r1, len, color, quiet) {
    const g = new T.Group(), c = part(new T.CylinderGeometry(r0, r1, len, 10), color), j = part(new T.SphereGeometry(r0 * 1.03, 10, 8), color);
    if (quiet) { soft(c); soft(j); }
    c.position.y = -len / 2; g.add(c, j);
    return g;
  }
  // torso outline from waist to neck: [radius, height], both as fractions
  const PROFILE = [[0.001, 0], [0.168, 0.001], [0.176, 0.12], [0.186, 0.4], [0.212, 0.7], [0.214, 0.84], [0.16, 0.94], [0.07, 0.995], [0.001, 1]];
  const rAt = (k) => { for (let i = 1; i < PROFILE.length; i++) if (k <= PROFILE[i][1]) { const a = PROFILE[i - 1], b = PROFILE[i]; return a[0] + (b[0] - a[0]) * ((k - a[1]) / (b[1] - a[1] || 1)); } return 0; };

  W.makeFigure = function (o) {
    const s = o.height / 1.75, gth = o.girth || 1, skin = o.skin || '#a8754f', top = o.shirt || '#ff8a1f', pants = o.pants || '#2f3a48', boot = '#17181a';
    const legH = 0.86 * s, thighL = 0.45 * s, shinL = 0.36 * s, torsoH = 0.6 * s, hipW = 0.095 * gth;
    const g = new T.Group(), body = new T.Group();
    g.add(body);
    const mkLeg = (side) => {
      const leg = seg(0.083 * gth, 0.064 * gth, thighL, pants); leg.position.set(side * hipW, legH, 0);
      const knee = seg(0.062 * gth, 0.046 * gth, shinL, pants); knee.position.y = -thighL;
      const shoe = soft(part(new T.BoxGeometry(0.105 * gth, 0.09 * s, 0.2 * s), boot)); shoe.position.set(0, -shinL - 0.005 * s, 0.035 * s);
      const toe = soft(part(new T.SphereGeometry(0.056 * gth, 10, 6), boot)); toe.scale.set(0.94, 0.8, 1.5); toe.position.set(0, -shinL - 0.008 * s, 0.13 * s);
      knee.add(shoe, toe); leg.add(knee); leg.userData.knee = knee; body.add(leg);
      return leg;
    };
    const legL = mkLeg(-1), legR = mkLeg(1);
    const torso = part(new T.LatheGeometry(PROFILE.map(([r, y]) => new T.Vector2(r * gth, y * torsoH)), 18), top); torso.scale.z = 0.62; torso.position.y = legH;
    const pelvis = part(new T.SphereGeometry(0.178 * gth, 14, 10), pants); pelvis.scale.set(1, 0.52, 0.64); pelvis.position.y = legH + 0.01;
    const neck = part(new T.CylinderGeometry(0.048 * s, 0.055 * s, 0.1 * s, 10), skin); neck.position.y = legH + torsoH + 0.035 * s;
    const hy = legH + torsoH + 0.16 * s;
    const head = part(new T.SphereGeometry(0.108 * s, 18, 14), skin); head.scale.set(0.93, 1.1, 1); head.position.y = hy;
    const hair = soft(part(new T.SphereGeometry(0.113 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), o.hair || '#1b1512', { roughness: 0.9 })); hair.scale.set(0.95, 1.08, 1.02); hair.rotation.x = -0.55; hair.position.y = hy + 0.004;
    body.add(torso, pelvis, neck, head, hair);
    // short sleeves: the arm is skin, with the shirt over the shoulder and upper arm
    const aw = Math.min(gth, 1.25), shoulderY = legH + torsoH * 0.86, armX = 0.205 * gth + 0.04;
    const mkArm = (side) => {
      const up = seg(0.047 * aw, 0.04 * aw, 0.3 * s, skin, true); up.position.set(side * armX, shoulderY, 0);
      const sleeve = soft(part(new T.CylinderGeometry(0.058 * aw, 0.054 * aw, 0.17 * s, 10), top)); sleeve.position.y = -0.085 * s;
      const cap = soft(part(new T.SphereGeometry(0.062 * aw, 10, 8), top));
      const fore = seg(0.039 * aw, 0.031 * aw, 0.26 * s, skin, true); fore.position.y = -0.3 * s;
      const hand = soft(part(new T.SphereGeometry(0.043 * s, 10, 8), skin)); hand.scale.set(0.75, 1.2, 0.55); hand.position.y = -0.295 * s;
      fore.add(hand); up.add(sleeve, cap, fore); up.userData.elbow = fore; body.add(up);
      return up;
    };
    const armL = mkArm(-1), armR = mkArm(1);
    const kitHat = [], kitVest = [], hatG = new T.Group(), vestG = new T.Group();
    body.add(hatG, vestG);
    if (o.hat === 'helmet') {
      const c = o.hatColor || '#f2c21b', shell = part(new T.SphereGeometry(0.128 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), c, { roughness: 0.35 }), brim = part(new T.CylinderGeometry(0.142 * s, 0.142 * s, 0.014, 20), c, { roughness: 0.35 });
      shell.scale.set(1, 0.95, 1.08); shell.position.y = hy + 0.022 * s;
      brim.scale.z = 1.12; brim.position.set(0, hy + 0.026 * s, 0.022 * s);
      hatG.add(soft(shell), soft(brim)); kitHat.push(hatG);
    } else if (o.hat === 'cap') {
      const c = o.hatColor || '#1d3b6e', crown = part(new T.SphereGeometry(0.119 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), c), peak = part(new T.BoxGeometry(0.16 * s, 0.014, 0.12 * s), c);
      crown.scale.set(0.97, 0.92, 1.03); crown.position.y = hy + 0.03 * s; peak.position.set(0, hy + 0.04 * s, 0.14 * s);
      body.add(crown, peak);
    }
    if (o.vest) {
      const refl = { emissive: '#ffffff', emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.3 };
      [0.3, 0.58].forEach((k) => { const r = rAt(k) * gth * 1.035, band = part(new T.CylinderGeometry(r, r, 0.045 * s, 18, 1, true), '#e6e9ec', refl); band.scale.z = 0.635; band.position.y = legH + torsoH * k; vestG.add(soft(band)); });
      [-1, 1].forEach((sd) => { const strap = part(new T.BoxGeometry(0.045, torsoH * 0.5, 0.012), '#e6e9ec', refl); strap.position.set(sd * 0.085 * gth, legH + torsoH * 0.6, 0.118 * gth); vestG.add(soft(strap)); });
      kitVest.push(vestG);
    }
    let tag = null;
    if (o.label) { tag = W.makeLabel(o.label, { size: 0.62, bg: 'rgba(242,179,27,0.96)', fg: '#1a1300', weight: 700 }); tag.position.y = hy + 0.55; g.add(tag); }
    W.mergeStatic(g, new Set([head]));
    g.userData = { kitHat, kitVest, legL, legR, armL, armR, elbowL: armL.userData.elbow, elbowR: armR.userData.elbow, kneeL: legL.userData.knee, kneeR: legR.userData.knee, body, head, legH, s, tag };
    figs.push(g);
    return g;
  };

  // knees follow the hips: the trailing leg bends in a stride, and a raised thigh (sitting, driving) drops the shin
  const flex = (x) => Math.max(0.06 + 0.85 * Math.max(0, x), x < -0.6 ? -x * Math.min(1, (-x - 0.6) / 0.5) : 0);
  B.hooks.frame.push(() => {
    for (let i = figs.length - 1; i >= 0; i--) {
      const g = figs[i], u = g.userData;
      if (g.parent) u.live = true; else if (u.live) { figs.splice(i, 1); continue; }
      u.kneeL.rotation.x = flex(u.legL.rotation.x); u.kneeR.rotation.x = flex(u.legR.rotation.x);
    }
  });
})();
