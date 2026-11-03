/* Building 19 - forklift batteries: drain while working, drive to the charger below 20%, charge back to 90% */
(function () {
  const B = window.B100, S = B.sim, T = THREE;
  const R = B.rng(515);
  const RATE = { work: 14, idle: 2, charge: 32 }; // % per simulated hour
  const LOW = 20, FULL = 90;
  const st = { charges: 0, chargeH: 0 };
  const barBg = new T.MeshBasicMaterial({ color: '#1a1f24', toneMapped: false });

  function bar(f) {
    if (f.mesh.userData.bat) return f.mesh.userData.bat;
    const g = new T.Group(); g.position.set(0, 3.25, 0.3);
    const bg = new T.Mesh(new T.PlaneGeometry(0.9, 0.16), barBg);
    const fill = new T.Mesh(new T.PlaneGeometry(0.84, 0.1), new T.MeshBasicMaterial({ color: '#2fbf5a', toneMapped: false }));
    fill.position.z = 0.01; g.add(bg, fill); g.userData.fill = fill;
    f.mesh.add(g); f.mesh.userData.bat = g;
    return g;
  }

  let last = S.st.t;
  B.hooks.frame.push(() => {
    const now = S.st.t, h = Math.max(0, now - last) / 3600; last = now;
    S.forklifts.forEach((f) => {
      if (f.battery == null) f.battery = 55 + R() * 45;
      if (f.down) return;
      if (f.phase === 'charging') {
        f.battery = Math.min(100, f.battery + RATE.charge * h); f.busyT = f.chargeBusy; st.chargeH += h;
        if (f.battery >= FULL) { f.phase = 'idle'; f.needCharge = false; S.addLog('Forklift ' + f.n + ' charged to ' + Math.round(f.battery) + '%, back to work', 'info'); }
      } else {
        f.battery = Math.max(3, f.battery - (f.phase === 'idle' ? RATE.idle : RATE.work) * h);
        if (f.phase === 'idle' && f.battery < LOW && !f.needCharge) {
          f.needCharge = true; st.charges++;
          S.addLog('Forklift ' + f.n + ' battery at ' + Math.round(f.battery) + '%: driving to the charger', 'warn');
          if (f.at === f.home) f.phase = 'charging'; else S.goHome(f);
        }
      }
      if (f.phase === 'charging' && f.chargeBusy == null) f.chargeBusy = f.busyT;
      if (f.phase !== 'charging') f.chargeBusy = null;
      // a small battery gauge above the roof
      const g = bar(f), fill = g.userData.fill, k = f.battery / 100;
      fill.scale.x = Math.max(0.02, k); fill.position.x = -0.42 * (1 - k);
      fill.material.color.set(f.phase === 'charging' ? '#33a3ff' : f.battery > 50 ? '#2fbf5a' : f.battery > LOW ? '#e2a400' : '#e5372b');
      g.quaternion.copy(B.three.camera.quaternion);
      g.quaternion.premultiply(f.mesh.quaternion.clone().invert());
    });
  });

  const describe = S.describeForklift;
  S.describeForklift = (n) => {
    const r = describe(n);
    if (!r) return r;
    if (r.f.phase === 'charging') { r.status = 'Charging at its charger'; r.detail = ''; }
    else if (r.f.needCharge) r.status = 'Driving to the charger (battery low)';
    r.status += ' · battery ' + Math.round(r.f.battery || 0) + '%';
    return r;
  };
  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => {
    const ch = S.forklifts.filter((f) => f.phase === 'charging' || f.needCharge);
    return ch.length >= 2 ? [{ key: 'bat' + ch.length, level: 'warn', text: ch.length + ' forklifts charging at the same time', sub: 'Fewer forklifts on the floor. Charging in breaks or on a rota keeps the fleet available.', act: 'Fleet', go: () => B.tools.open('fleet') }] : [];
  });
  B.battery = { stats: st, RATE, LOW, FULL };
})();
