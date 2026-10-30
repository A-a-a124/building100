/* Building 100 - weather: summer heat and dust storms that slow work, ground the yard drone and cut visibility */
(function () {
  const B = window.B100, S = B.sim, T = THREE, P = B.panel;
  const { scene, sun, hemi, camera } = B.three;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const CAPTURE = /[?&]capture/.test(location.search);
  const R = B.rng(31);
  const SEASONS = { summer: { name: 'Summer', lo: 31, hi: 47, dust: 0.05 }, mild: { name: 'Spring / autumn', lo: 23, hi: 36, dust: 0.03 }, winter: { name: 'Winter', lo: 11, hi: 23, dust: 0.015 } };
  const m = new Date().getMonth();
  const w = { season: m >= 4 && m <= 8 ? 'summer' : m >= 10 || m <= 1 ? 'winter' : 'mild', dust: null, wind: 15, temp: 30, vis: 10, auto: !CAPTURE };
  const hour = () => ((S.st.t / 3600) % 24 + 24) % 24;
  const tempAt = (h) => { const s = SEASONS[w.season]; return s.lo + (s.hi - s.lo) * (0.5 - 0.5 * Math.cos((2 * Math.PI * (h - 4)) / 24)); };
  // Saudi midday outdoor work ban applies in the summer months from 12:00 to 15:00
  const heatBan = () => w.season === 'summer' && hour() >= 12 && hour() < 15;

  function startDust(hours) {
    w.dust = { until: S.st.t + (hours || 2 + R() * 3) * 3600, wind: 45 + R() * 20, vis: 0.3 + R() * 0.6 };
    w.wind = w.dust.wind; w.vis = w.dust.vis;
    S.addLog('Dust storm: wind ' + Math.round(w.dust.wind) + ' km/h, visibility ' + fmt(w.dust.vis * 1000, 0) + ' m. Yard drone grounded.', 'warn');
    if (!CAPTURE) B.tools.toast('Dust storm: the yard drone is grounded and trucks are delayed', 5000);
  }
  function endDust() { if (!w.dust) return; w.dust = null; S.addLog('Dust storm over: yard operations back to normal', 'info'); }

  // fewer trucks and orders during a storm, slower work in the midday heat
  const baseRate = B.env.rateFactor;
  B.env.rateFactor = () => baseRate() * (w.dust ? 0.6 : 1) * (heatBan() ? 0.85 : 1);

  // the yard drone lands and waits while it is too windy
  const d2 = B.actors.byId('d2');
  const fly = d2.update;
  d2.update = (d, dt) => {
    if (w.wind <= 35) { if (d.grounded) { d.grounded = false; d.plan = []; } return fly(d, dt); }
    if (!d.grounded) { d.grounded = true; d.plan = [{ x: d.padX, y: d.padY + 6, z: d.padZ, sp: 4, label: 'Returning: wind too strong' }, { x: d.padX, y: d.padY, z: d.padZ, sp: 1.5, label: 'Landing' }, { wait: 1e9, label: 'Grounded: dust storm' }]; }
    return fly(d, dt);
  };

  // ---------- dust in the air ----------
  const N = 1800, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 160; pos[i * 3 + 1] = R() * 30; pos[i * 3 + 2] = (R() - 0.5) * 160; }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dustPts = new T.Points(geo, new T.PointsMaterial({ color: '#c9a877', size: 0.5, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  dustPts.visible = false; scene.add(dustPts);
  const DUST = new T.Color('#b39566');
  let haze = 0;

  const chip = document.createElement('div');
  chip.className = 'wxchip'; chip.setAttribute('role', 'button'); chip.tabIndex = 0;
  B.three.stage.appendChild(chip);
  chip.addEventListener('click', () => B.tools.open('weather'));
  chip.addEventListener('keydown', (e) => { if (e.key === 'Enter') B.tools.open('weather'); });
  const css = document.createElement('style');
  css.textContent = `.wxchip { position: absolute; z-index: 3; right: 12px; top: 64px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; font: 600 13px var(--f-mono); box-shadow: var(--shadow); cursor: pointer; }
    .wxchip.dust { background: #8a6a3a; color: #fff; border-color: transparent; } .wxchip.hot { background: #c4501b; color: #fff; border-color: transparent; } body.cine .wxchip { display: none; }`;
  document.head.appendChild(css);

  let t = 0;
  B.hooks.frame.push((dt) => {
    const h = hour();
    w.temp = tempAt(h) - (w.dust ? 3 : 0);
    if (w.dust && S.st.t > w.dust.until) endDust();
    if (w.auto && !w.dust && S.st.running && R() < (SEASONS[w.season].dust / 3600) * dt * S.st.speed) startDust();
    w.wind = w.dust ? w.dust.wind : 12 + 8 * Math.sin(h / 3.8);
    w.vis = w.dust ? w.dust.vis : 10;
    // blend the scene towards a brown haze while a storm lasts (the environment module has already set the daylight)
    haze += ((w.dust ? 1 : 0) - haze) * Math.min(1, dt * 0.6);
    if (haze > 0.01) {
      sun.intensity *= 1 - 0.6 * haze; hemi.intensity *= 1 - 0.25 * haze;
      scene.background.lerp(DUST, 0.75 * haze);
      if (scene.fog) { scene.fog.color.copy(scene.background); scene.fog.near = 220 - 205 * haze; scene.fog.far = 520 - 380 * haze; }
    } else if (scene.fog && scene.fog.near !== 220) { scene.fog.near = 220; scene.fog.far = 520; }
    dustPts.visible = haze > 0.05;
    if (dustPts.visible) {
      dustPts.material.opacity = 0.55 * haze;
      const c = B.three.controls.target, a = geo.attributes.position.array, sp = (w.wind / 3.6) * dt;
      for (let i = 0; i < N; i++) {
        a[i * 3] += sp * (0.8 + (i % 5) * 0.1); a[i * 3 + 1] += Math.sin(i + performance.now() / 700) * 0.01;
        if (a[i * 3] > 80) a[i * 3] -= 160;
      }
      dustPts.position.set(c.x, 0, c.z);
      geo.attributes.position.needsUpdate = true;
    }
    if ((t += dt) > 0.5) {
      t = 0;
      chip.className = 'wxchip' + (w.dust ? ' dust' : heatBan() ? ' hot' : '');
      chip.textContent = Math.round(w.temp) + '°C · ' + (w.dust ? 'Dust storm' : heatBan() ? 'Midday heat' : 'Clear') + ' · ' + Math.round(w.wind) + ' km/h';
    }
  });

  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => {
    const out = [];
    if (w.dust) out.push({ key: 'dust' + Math.round(w.dust.until), level: 'warn', text: 'Dust storm: yard drone grounded', sub: 'Visibility ' + fmt(w.dust.vis * 1000, 0) + ' m, wind ' + Math.round(w.wind) + ' km/h. Truck arrivals down about 40%.', act: 'Weather', go: () => B.tools.open('weather') });
    if (heatBan()) out.push({ key: 'heat', level: 'warn', text: 'Midday heat ' + Math.round(w.temp) + '°C: outdoor work paused until 15:00', sub: 'Summer midday work ban for work under direct sun. Yard work moves to the morning and evening.', act: 'Weather', go: () => B.tools.open('weather') });
    return out;
  });

  function render(el) {
    const s = SEASONS[w.season];
    el.innerHTML = `<h4>Weather in the yard</h4><p>The open yard works under the sky. Dust storms ground the yard drone, cut visibility and delay trucks on the road. In summer, outdoor work stops from 12:00 to 15:00 under the midday work ban.</p>
      <div class="row2"><div class="stat"><b>${Math.round(w.temp)}°C</b><small>temperature now</small></div><div class="stat"><b>${Math.round(w.wind)} km/h</b><small>wind</small></div>
      <div class="stat"><b>${w.dust ? fmt(w.vis * 1000, 0) + ' m' : '10 km+'}</b><small>visibility</small></div><div class="stat"><b>${w.dust ? ('Grounded') : ('Flying')}</b><small>yard drone D2</small></div></div>
      <label class="f">Season<select id="wxS">${Object.entries(SEASONS).map(([k, q]) => '<option value="' + k + '"' + (k === w.season ? ' selected' : '') + '>' + q.name + '</option>').join('')}</select></label>
      <canvas id="wxC" width="840" height="260"></canvas>
      <h4>Effect on the work right now</h4><ul style="margin:0;padding-inline-start:18px;font-size:13px;display:grid;gap:4px">
        <li>Truck and order arrivals: <b>${Math.round(B.env.rateFactor() / Math.max(0.01, baseRate()) * 100)}%</b> of normal</li>
        <li>Yard drone survey: <b>${w.wind > 35 ? 'stopped' : 'running'}</b></li><li>Outdoor yard work: <b>${heatBan() ? 'paused for the heat' : w.dust ? 'only essential moves' : 'normal'}</b></li></ul>
      <label><input type="checkbox" id="wxAuto" ${w.auto ? 'checked' : ''}> Random dust storms (about ${fmt(s.dust * 24 * 100, 0)}% chance a day in ${s.name.toLowerCase()})</label>
      <div class="btnrow">${w.dust ? '<button class="btn" id="wxEnd">Clear the sky</button>' : '<button class="btn primary" id="wxGo">Start a dust storm</button>'}<button class="btn" id="wxLook">Look at the yard</button></div>`;
    chart(el.querySelector('#wxC'));
    el.querySelector('#wxS').addEventListener('change', (e) => { w.season = e.target.value; render(el); });
    el.querySelector('#wxAuto').addEventListener('change', (e) => (w.auto = e.target.checked));
    const go = el.querySelector('#wxGo'), end = el.querySelector('#wxEnd');
    if (go) go.addEventListener('click', () => { startDust(3); B.ui.setView('yard'); render(el); });
    if (end) end.addEventListener('click', () => { endDust(); render(el); });
    el.querySelector('#wxLook').addEventListener('click', () => B.ui.setView('yard'));
  }
  function chart(c) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), bad = cs.getPropertyValue('--bad').trim();
    const X = (h) => 60 + (h / 24) * 760, Y = (v) => 220 - ((v - 5) / 45) * 190;
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '17px "IBM Plex Sans", sans-serif';
    if (w.season === 'summer') { ctx.fillStyle = 'rgba(196,80,27,0.15)'; ctx.fillRect(X(12), 20, X(15) - X(12), 200); ctx.fillStyle = bad; ctx.fillText(('work ban'), X(12) + 4, 40); }
    ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.beginPath();
    for (let h = 0; h <= 24; h += 0.5) { const x = X(h), y = Y(tempAt(h)); h ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    const h = hour(); ctx.fillStyle = bad; ctx.beginPath(); ctx.arc(X(h), Y(tempAt(h)), 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = muted; [0, 6, 12, 18, 24].forEach((q) => ctx.fillText(String(q).padStart(2, '0') + ':00', X(q) - 20, 250));
    [10, 25, 40].forEach((v) => ctx.fillText(v + '°', 14, Y(v) + 6));
  }
  B.tools.add({ id: 'weather', label: 'Weather', render });
  B.weather = { state: w, startDust, endDust, heatBan, tempAt };
})();
