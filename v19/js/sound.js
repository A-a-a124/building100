/* Building 19 - light sound: warehouse ambience, reverse beepers, proximity warning, alarm during drills; synthesised, off until the visitor turns it on */
(function () {
  const B = window.B100, S = B.sim;
  const { camera } = B.three;
  let ctx = null, master = null, amb = null, on = false, tRev = 0, beepOn = false, tSiren = 0;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    // ambience: brown noise through a low filter, like air handling in a large hall
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    amb = ctx.createGain(); amb.gain.value = 0.32;
    src.connect(lp); lp.connect(amb); amb.connect(master); src.start();
  }
  function tone(freq, dur, gain, type) {
    if (!ctx || !on) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.setValueAtTime(gain, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.01);
  }
  const near = (x, z) => { const d = Math.hypot(camera.position.x - x, camera.position.z - z, camera.position.y); return Math.max(0.02, Math.min(1, 28 / (d + 4))); };
  function set(v) {
    on = v;
    if (v) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    if (master) master.gain.value = v ? 0.55 : 0;
    const b = document.getElementById('soundBtn'); if (b) { b.setAttribute('aria-pressed', v); b.lastChild.textContent = v ? 'Sound on' : 'Sound off'; }
    try { localStorage.setItem('b100.sound', v ? '1' : '0'); } catch (e) {}
  }
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'soundBtn'; btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>Sound off';
  document.getElementById('tourBtn').before(btn);
  btn.addEventListener('click', () => set(!on));

  B.hooks.frame.push((dt) => {
    if (!on || !ctx) return;
    // reverse beeper: dock forklifts backing out and trucks backing on to a door, loudest when close
    let rev = 0;
    (B.dockwork ? B.dockwork.list : []).forEach((q) => { if (q.reversing) rev = Math.max(rev, near(q.mesh.position.x, q.mesh.position.z)); });
    S.trucks.forEach((t) => { if (t.phase === 'arrive' && Math.abs(t.z - t.dockZ) < 26) rev = Math.max(rev, near(t.mesh.position.x, t.z)); });
    if (rev > 0.03) { if ((tRev += dt) > 0.45) { tRev = 0; beepOn = !beepOn; if (beepOn) tone(1040, 0.4, 0.13 * rev); } } else tRev = 0;
    // fire alarm during a drill
    if (B.evac && B.evac.active() && (tSiren += dt) > 0.5) { tSiren = 0; tone(740, 0.24, 0.13, 'sawtooth'); setTimeout(() => tone(980, 0.24, 0.13, 'sawtooth'), 250); }
    if (amb) amb.gain.value = 0.2 + 0.2 * Math.min(1, 20 / (camera.position.y + 2));
  });
  B.sound = { set, on: () => on, beep: () => tone(1760, 0.09, 0.14), alert: () => { tone(880, 0.14, 0.12); setTimeout(() => tone(660, 0.2, 0.12), 170); }, ok: () => { tone(880, 0.1, 0.1, 'sine'); setTimeout(() => tone(1320, 0.14, 0.1, 'sine'), 110); }, bad: () => tone(200, 0.22, 0.14, 'sawtooth') };
})();
