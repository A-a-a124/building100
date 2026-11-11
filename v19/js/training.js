/* Building 19 - training mode: six timed challenges for a new team member, with a score */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const { camera } = B.three;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let lastSlot = null;
  const show = P.showSlot;
  P.showSlot = function (s) { lastSlot = s; show(s); };

  const fullestRow = () => B.RACK.rows.map((r, i) => ({ r, n: B.SLOTS.filter((s) => s.row === i && s.item >= 0).length })).sort((a, b) => b.n - a.n)[0].r.letter;
  const CH = [
    { title: 'Find a gate valve', text: 'Use the search box to find "gate valve" and open one of its locations.', hint: 'Type gate valve in the search box on the left.', ok: () => lastSlot && lastSlot.item >= 0 && /gate valve/i.test(B.ITEMS[lastSlot.item].name) },
    { title: 'Go to a location', text: () => 'Open location ' + target.code + '. Location codes read row, bay, level, position.', hint: 'Type the code in the search box, or use Scan a label.', ok: () => lastSlot && lastSlot.code === target.code, setup: () => { target = B.SLOTS.filter((s) => s.item >= 0)[Math.floor(Math.random() * 2000)]; } },
    { title: 'Which row is fullest?', text: 'Open any location in the rack row that holds the most pallets.', hint: 'Colour the pallets or check the Zones list; rows A to N run front to back.', ok: () => lastSlot && lastSlot.letter === fullestRow() },
    { title: 'Fix a hazmat breach', text: 'Find the hazmat storage breach and fix it.', hint: 'Open Alerts or Data & analysis, then Safety, then Hazmat.', ok: () => (startHaz ? B.hazmat.violations().length < startHaz : true), setup: () => { startHaz = B.hazmat.violations().length; } },
    { title: 'Walk to the shipping doors', text: 'Switch to Walk mode and walk to the shipping doors on the south side.', hint: 'Use the Walk mode button, then W to walk; the shipping doors are at the back.', ok: () => B.walk && B.walk.active && camera.position.z > 30 },
    { title: 'Drive a forklift', text: 'Use Drive a forklift and bring the practice pallet to the green square.', hint: 'Drive under the pallet, press Space, drive to the green square, press Space again.', ok: () => B.drive && B.drive.delivered },
  ];
  let target = null, startHaz = 0, i = -1, t0 = 0, results = [];

  const card = document.createElement('div');
  card.className = 'trcard'; card.hidden = true;
  card.innerHTML = '<small id="trStep"></small><b id="trTitle"></b><p id="trText"></p><p id="trHint" class="hint" hidden></p><div class="btnrow"><span id="trTime"></span><button class="btn" id="trHintB">Hint</button><button class="btn" id="trSkip">Skip</button><button class="btn" id="trStop">Stop</button></div>';
  B.three.stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.trcard { position: absolute; z-index: 6; left: 12px; bottom: 14px; width: min(380px, calc(100% - 24px)); background: var(--surface); border: 1px solid var(--line); border-top: 4px solid #2fbf5a; border-radius: 12px; box-shadow: var(--shadow); padding: 12px 14px; display: grid; gap: 4px; }
    .trcard small { color: var(--muted); font: 700 11px var(--f-mono); } .trcard b { font: 700 16px var(--f-display); } .trcard p { margin: 0; font-size: 13px; } .trcard .hint { color: #b27f00; }
    .trcard .btnrow { align-items: center; } .trcard #trTime { font: 700 16px var(--f-mono); margin-right: auto; } body.cine .trcard { display: none; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);

  function go(k) {
    i = k; t0 = S.st.running ? performance.now() : performance.now();
    if (i >= CH.length) return finish();
    const c = CH[i]; if (c.setup) c.setup();
    $('trStep').textContent = 'TRAINING · ' + (i + 1) + ' / ' + CH.length;
    $('trTitle').textContent = c.title; $('trText').textContent = typeof c.text === 'function' ? c.text() : c.text;
    $('trHint').hidden = true; $('trHint').textContent = c.hint; c.usedHint = false;
    lastSlot = null; card.hidden = false;
  }
  function score(sec, hint) { return Math.max(20, Math.round(100 - sec / 3)) - (hint ? 15 : 0); }
  function finish() {
    card.hidden = true;
    const total = results.reduce((n, r) => n + r.points, 0), best = +(store.get('b100.trainBest') || 0);
    if (total > best) store.set('b100.trainBest', total);
    i = -1; B.tools.open('training');
    B.tools.toast('Training complete: ' + total + ' points' + (total > best ? ', a new best!' : ''), 5000);
  }
  B.hooks.frame.push(() => {
    if (i < 0 || i >= CH.length) return;
    const sec = (performance.now() - t0) / 1000;
    $('trTime').textContent = Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
    if (CH[i].ok()) { results.push({ title: CH[i].title, sec, points: score(sec, CH[i].usedHint) }); B.tools.toast('Well done: ' + CH[i].title.toLowerCase()); go(i + 1); }
  });
  $('trHintB').addEventListener('click', () => { $('trHint').hidden = false; CH[i].usedHint = true; });
  $('trSkip').addEventListener('click', () => { results.push({ title: CH[i].title, sec: null, points: 0 }); go(i + 1); });
  $('trStop').addEventListener('click', () => { card.hidden = true; i = -1; });

  function render(el) {
    const best = +(store.get('b100.trainBest') || 0), total = results.reduce((n, r) => n + r.points, 0);
    el.innerHTML = `<h4>Training mode</h4><p>Six short challenges that teach a new team member how to find things in Building 19: searching, location codes, reading the racks, hazmat rules, walking the floor and driving. Faster answers score more; a hint costs 15 points.</p>
      <div class="row2"><div class="stat"><b>${results.length ? total : '-'}</b><small>last score (out of ${CH.length * 100})</small></div><div class="stat"><b>${best || '-'}</b><small>best score in this browser</small></div></div>
      <div class="btnrow"><button class="btn primary" id="trGo">Start training</button></div>
      <ol style="margin:0;padding-inline-start:18px;font-size:13px;display:grid;gap:4px">${CH.map((c) => '<li>' + c.title + '</li>').join('')}</ol>
      ${results.length ? '<h4>Last run</h4><table><tbody>' + results.map((r) => '<tr><td>' + r.title + '</td><td class="num">' + (r.sec == null ? 'skipped' : Math.round(r.sec) + ' s') + '</td><td class="num">' + r.points + '</td></tr>').join('') + '</tbody></table>' : ''}`;
    el.querySelector('#trGo').addEventListener('click', () => { results = []; document.getElementById('drawerClose').click(); go(0); });
  }
  B.tools.add({ id: 'training', label: 'Training', render });
  B.training = { start: () => { results = []; go(0); }, challenges: CH };
})();
