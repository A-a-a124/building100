/* Building 19 - view tools: full-quality switch, shareable view links, photo mode */
(function () {
  const B = window.B100, T = THREE;
  const { renderer, camera, controls, scene, stage } = B.three;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------- full quality ----------
  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyFull">Full quality (never reduce)</label>');
  const fullBox = document.getElementById('lyFull');
  fullBox.hidden = false;
  fullBox.parentElement.hidden = !document.querySelector('.ovl.layers label:not([hidden])');
  fullBox.addEventListener('change', () => {
    const on = fullBox.checked;
    store.set('b100.full', on ? '1' : '0');
    if (on) { const low = document.getElementById('lyLow'); if (low && low.checked) { low.checked = false; low.dispatchEvent(new Event('change')); } }
    B.perf.setFull(on);
    B.tools.toast(on ? 'Full quality: highest resolution and shadows, never reduced' : 'Quality adapts to the device again');
  });
  if (store.get('b100.full') === '1') { fullBox.checked = true; B.perf.setFull(true); }

  // ---------- buttons at the end of the views bar ----------
  const views = document.getElementById('views');
  views.insertAdjacentHTML('beforeend', '<button class="vbtn" id="vLink" title="Copy a link that opens this exact view">Copy link</button><button class="vbtn" id="vPhoto" title="Hide the interface and save a picture">Photo mode</button>');

  // ---------- view links: camera and selection in the address ----------
  const r1 = (n) => Math.round(n * 10) / 10;
  let selected = null;
  const show = B.panel.showSlot;
  B.panel.showSlot = function (s) { selected = s; show(s); };
  const showZone = B.panel.showZone;
  B.panel.showZone = function (id) { selected = null; showZone(id); };
  function link() {
    const p = camera.position, t = controls.target;
    let h = 'view=' + [p.x, p.y, p.z, t.x, t.y, t.z].map(r1).join(',');
    if (selected && document.getElementById('details').textContent.includes(selected.code)) h += '&loc=' + selected.code;
    return location.href.split('#')[0] + '#' + h;
  }
  document.getElementById('vLink').addEventListener('click', async () => {
    const url = link();
    try { await navigator.clipboard.writeText(url); B.tools.toast('Link copied: anyone who opens it lands on this view'); }
    catch (e) { window.prompt('Copy this link:', url); }
  });
  function openFromHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const v = (h.get('view') || '').split(',').map(Number);
    if (v.length !== 6 || v.some(isNaN)) return false;
    const code = h.get('loc'), s = code && B.SLOTS.find((q) => q.code === code);
    if (s) B.ui.focusSlot(s, false);
    B.ui.flyTo([v[0], v[1], v[2]], [v[3], v[4], v[5]], 1.6);
    document.querySelectorAll('.vbtn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    return true;
  }
  setTimeout(openFromHash, 400);
  addEventListener('hashchange', openFromHash);

  // ---------- photo mode ----------
  const bar = document.createElement('div');
  bar.className = 'photobar'; bar.hidden = true;
  bar.innerHTML = '<span>Photo mode · drag to frame the shot</span><button class="btn primary" id="phSave">Save photo</button><button class="btn" id="phLabels">Hide labels</button><button class="btn" id="phExit">Exit</button>';
  document.body.appendChild(bar);
  const css = document.createElement('style');
  css.textContent = `.photobar { position: fixed; z-index: 40; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; background: rgba(16,22,29,0.88); color: #fff; padding: 8px 10px 8px 14px; border-radius: 12px; box-shadow: var(--shadow); font: 600 13px var(--f-body, inherit); }
    body.photo .databadge, body.photo .wxchip, body.photo .mmap, body.photo .hocard, body.photo .drill, body.photo .toast { display: none !important; }`;
  document.head.appendChild(css);
  let labelsWere = true;
  function enter() { document.body.classList.add('cine', 'photo'); bar.hidden = false; labelsWere = B.world.labels.visible; }
  function exit() { document.body.classList.remove('cine', 'photo'); bar.hidden = true; B.world.labels.visible = labelsWere; document.getElementById('phLabels').textContent = 'Hide labels'; }
  function save() {
    const pr = renderer.getPixelRatio(), r = stage.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(3, Math.max(2, (devicePixelRatio || 1) * 2)));
    renderer.setSize(r.width, r.height, false);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(pr); renderer.setSize(r.width, r.height, false);
    const a = document.createElement('a');
    a.href = url; a.download = 'building19-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  document.getElementById('vPhoto').addEventListener('click', enter);
  document.getElementById('phExit').addEventListener('click', exit);
  document.getElementById('phSave').addEventListener('click', save);
  document.getElementById('phLabels').addEventListener('click', (e) => { B.world.labels.visible = !B.world.labels.visible; e.target.textContent = B.world.labels.visible ? 'Hide labels' : 'Show labels'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bar.hidden) exit(); });
  B.viewtools = { link, openFromHash, photo: { enter, exit, save } };
})();
