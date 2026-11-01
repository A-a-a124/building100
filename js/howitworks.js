/* Building 100 - "How a twin works": the loop from the real warehouse through sensors and the twin to decisions, with live values and moving data */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const NODES = [
    { x: 150, y: 110, title: 'The real warehouse', sub: 'Trucks, forklifts, pallets, people', live: () => S.forklifts.filter((f) => f.path && f.path.length).length + ' forklifts moving · ' + S.trucks.length + ' trucks', say: 'Everything starts on the floor: every pallet moved and every truck that arrives is an event in the real warehouse.' },
    { x: 610, y: 110, title: 'Sensors and systems', sub: 'RFID, door and rack sensors, trackers, SAP', live: () => B.sensors.count() + ' sensors · ' + B.sensors.perMinute() + ' readings a minute', say: 'Sensors and business systems capture those events and send them on, as you can see flowing up to the hub behind this panel.' },
    { x: 610, y: 300, title: 'The digital twin', sub: 'A live copy that also simulates what comes next', live: () => fmt(B.SLOTS.length) + ' locations mirrored · ' + fmt(B.audit.list.length) + ' changes logged', say: 'The twin keeps an exact live copy of the warehouse. Because it is a model, it can also run forward in time and try changes safely.' },
    { x: 150, y: 300, title: 'Decisions', sub: 'Alerts, forecasts, what-if, best setup', live: () => { const a = B.alerts.list().filter((q) => q.level !== 'info')[0]; return a ? a.text : 'No open alerts'; }, say: 'The answers reach the people who decide: what needs attention now, what will happen next, and which change works best.' },
  ];
  const PATHS = ['M 245 110 L 515 110', 'M 610 150 L 610 260', 'M 515 300 L 245 300', 'M 150 260 L 150 150'];
  const LINKS = ['events', 'live data', 'insight', 'actions on the floor'];

  const box = document.createElement('div');
  box.className = 'hiw'; box.hidden = true;
  box.innerHTML = `<div class="hiwHead"><h3>How a digital twin works</h3><button class="chip" id="hiwX">Close</button></div>
    <svg viewBox="0 0 760 410" role="img" aria-label="Loop from the real warehouse to sensors, the twin, decisions and back">
      <defs><marker id="hiwArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#7fe0ff"/></marker></defs>
      ${PATHS.map((d, i) => '<path id="hiwP' + i + '" d="' + d + '" stroke="#3b6b85" stroke-width="3" fill="none" marker-end="url(#hiwArrow)"/>').join('')}
      ${[[380, 98], [628, 210], [380, 288], [40, 210]].map(([x, y], i) => '<text x="' + x + '" y="' + y + '" fill="#9fc4d8" font-size="14" text-anchor="' + (i === 3 ? 'start' : i === 1 ? 'start' : 'middle') + '">' + LINKS[i] + '</text>').join('')}
      ${NODES.map((n, i) => `<g class="hiwNode" id="hiwN${i}"><rect x="${n.x - 130}" y="${n.y - 52}" width="260" height="104" rx="14"/><text x="${n.x}" y="${n.y - 22}" class="t">${n.title}</text><text x="${n.x}" y="${n.y}" class="s">${n.sub}</text><text x="${n.x}" y="${n.y + 26}" class="l" id="hiwL${i}"></text></g>`).join('')}
      <g id="hiwDots"></g>
    </svg><p id="hiwSay"></p>`;
  B.three.stage.appendChild(box);
  const css = document.createElement('style');
  css.textContent = `.hiw { position: absolute; z-index: 6; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(780px, calc(100% - 32px)); background: rgba(8,16,24,0.88); color: #fff; border-radius: 18px; padding: 14px 18px; box-shadow: 0 24px 70px rgba(0,0,0,0.45); backdrop-filter: blur(6px); }
    .hiwHead { display: flex; justify-content: space-between; align-items: center; } .hiw h3 { margin: 0; font: 800 20px var(--f-display); } .hiw .chip { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }
    .hiw svg { width: 100%; display: block; } .hiwNode rect { fill: #122433; stroke: #3b6b85; stroke-width: 2; transition: stroke 0.3s, fill 0.3s; } .hiwNode.on rect { fill: #17405a; stroke: #7fe0ff; stroke-width: 3; }
    .hiwNode text { text-anchor: middle; fill: #fff; } .hiwNode .t { font: 700 17px Archivo, Arial, sans-serif; } .hiwNode .s { font-size: 11.5px; fill: #a9bdcb; } .hiwNode .l { font: 600 12px "IBM Plex Mono", monospace; fill: #f2b31b; }
    .hiw p { margin: 6px 0 2px; font-size: 15px; line-height: 1.45; color: #dfe8ef; min-height: 44px; } body.present .hiw { z-index: 39; top: 44%; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);

  const dots = [];
  function buildDots() {
    if (dots.length) return;
    for (let k = 0; k < 16; k++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', 4.5); c.setAttribute('fill', '#7fe0ff'); $('hiwDots').appendChild(c);
      dots.push({ c, seg: k % 4, k: (k * 0.27) % 1 });
    }
  }
  let step = 0, st = 0, sensorsWere = false;
  function show(i) {
    step = i; st = 0;
    NODES.forEach((_, n) => $('hiwN' + n).classList.toggle('on', n === i));
    $('hiwSay').textContent = NODES[i].say;
  }
  function open() { buildDots(); sensorsWere = B.sensors.on(); B.sensors.setOn(true); box.hidden = false; show(0); B.ui.flyTo([-110, 95, 130], [0, 8, 0], 1.6); }
  function close() { box.hidden = true; if (!sensorsWere) B.sensors.setOn(false); }
  $('hiwX').addEventListener('click', close);
  let tl = 0;
  B.hooks.frame.push((dt) => {
    if (box.hidden) return;
    st += dt; if (st > 6) show((step + 1) % 4);
    dots.forEach((d) => { d.k += dt * 0.45; if (d.k > 1) d.k -= 1; const p = $('hiwP' + d.seg), pt = p.getPointAtLength(d.k * p.getTotalLength()); d.c.setAttribute('cx', pt.x); d.c.setAttribute('cy', pt.y); d.c.setAttribute('opacity', d.seg === step ? 1 : 0.35); });
    if ((tl += dt) > 0.6) { tl = 0; NODES.forEach((n, i) => { const t = n.live(); $('hiwL' + i).textContent = t.length > 38 ? t.slice(0, 37) + '…' : t; }); }
  });
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vHow" title="See how a digital twin works">How a twin works</button>');
  document.getElementById('vHow').addEventListener('click', () => (box.hidden ? open() : close()));
  B.howItWorks = { open, close, isOpen: () => !box.hidden };
})();
