/* Building 19 - reality vs twin: add photos of the real warehouse, save the matching view, and drag a slider between the photo and the model */
(function () {
  const B = window.B100, P = B.panel;
  const { renderer, scene, camera, controls } = B.three;
  const DB = 'b100-reality';
  let pairs = [], current = null;
  function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function load() { try { const d = await db(); pairs = await new Promise((res) => { const q = d.transaction('p').objectStore('p').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); } catch (e) { pairs = []; } }
  async function put(p) { try { const d = await db(); d.transaction('p', 'readwrite').objectStore('p').put(p); } catch (e) {} }
  async function del(id) { try { const d = await db(); d.transaction('p', 'readwrite').objectStore('p').delete(id); } catch (e) {} }
  function snap() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.88); }
  const shrink = (file) => new Promise((res, rej) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / img.width), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg', 0.85)); }; img.onerror = rej; img.src = URL.createObjectURL(file); });

  // full-screen slider view
  const ov = document.createElement('div');
  ov.className = 'rvov'; ov.hidden = true;
  ov.innerHTML = '<div class="rvframe" id="rvF"><img id="rvA" alt="Digital twin view"><div id="rvClip"><img id="rvB" alt="Photo of the real warehouse"></div><div id="rvLine"></div><span class="rvt l">Reality</span><span class="rvt r">Digital twin</span></div><div class="btnrow"><b id="rvName"></b><button class="btn" id="rvGo">Go to this view</button><button class="btn" id="rvX">Close</button></div>';
  document.body.appendChild(ov);
  const css = document.createElement('style');
  css.textContent = `.rvov { position: fixed; inset: 0; z-index: 45; background: rgba(6,10,14,0.92); display: grid; place-items: center; align-content: center; gap: 12px; padding: 20px; } .rvov .btnrow { align-items: center; color: #fff; } .rvov .btn:not(.primary) { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }
    .rvframe { position: relative; width: min(1200px, 92vw); aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; cursor: ew-resize; user-select: none; touch-action: none; } .rvframe img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    #rvClip { position: absolute; inset: 0; overflow: hidden; width: 50%; } #rvClip img { width: min(1200px, 92vw); max-width: none; } #rvLine { position: absolute; top: 0; bottom: 0; left: 50%; width: 3px; background: #f2b31b; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
    .rvt { position: absolute; bottom: 10px; background: rgba(0,0,0,0.65); color: #fff; padding: 3px 10px; border-radius: 999px; font: 700 13px var(--f-display); } .rvt.l { left: 10px; } .rvt.r { right: 10px; }
    .rvGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .rvItem { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; cursor: pointer; background: var(--surface-2); } .rvItem img { width: 100%; display: block; aspect-ratio: 16/10; object-fit: cover; } .rvItem div { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 12px; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);
  function open(p) { current = p; $('rvA').src = p.twin; $('rvB').src = p.photo; $('rvName').textContent = p.name; ov.hidden = false; setPos(0.5); }
  function setPos(k) { $('rvClip').style.width = k * 100 + '%'; $('rvLine').style.left = k * 100 + '%'; }
  let drag = false;
  const move = (e) => { const r = $('rvF').getBoundingClientRect(); setPos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); };
  $('rvF').addEventListener('pointerdown', (e) => { drag = true; move(e); });
  addEventListener('pointermove', (e) => { if (drag) move(e); });
  addEventListener('pointerup', () => (drag = false));
  $('rvX').addEventListener('click', () => (ov.hidden = true));
  $('rvGo').addEventListener('click', () => { ov.hidden = true; const c = current.cam; B.ui.flyTo(c.slice(0, 3), c.slice(3), 1.4); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ov.hidden = true; });

  async function add(file, el) {
    try {
      const photo = await shrink(file), p = camera.position, t = controls.target;
      const pair = { id: Date.now(), name: file.name.replace(/\.[^.]+$/, ''), photo, twin: snap(), cam: [p.x, p.y, p.z, t.x, t.y, t.z] };
      pairs.unshift(pair); await put(pair); render(el); open(pair);
    } catch (e) { B.tools.toast('That file could not be read as a picture'); }
  }
  function render(el) {
    el.innerHTML = `<h4>Reality vs twin</h4><p>Line the 3D view up with a spot in the real warehouse, then add your photo of the same spot. Drag the slider to compare them. Photos stay in this browser and are never uploaded.</p>
      <ol style="margin:0;padding-inline-start:18px;font-size:13px;display:grid;gap:3px"><li>Move the 3D view to match where the photo was taken.</li><li>Add the photo below: the current view is saved with it.</li><li>Open the pair and drag the slider in front of your audience.</li></ol>
      <label class="drop" id="rvDrop" tabindex="0">Drop a photo here, or click to choose<input type="file" id="rvFile" accept="image/*" hidden></label>
      ${pairs.length ? '<div class="rvGrid">' + pairs.map((p) => '<div class="rvItem" data-id="' + p.id + '"><img src="' + p.photo + '" alt=""><div><span>' + P.esc(p.name) + '</span><button class="chip" data-del="' + p.id + '">Remove</button></div></div>').join('') + '</div>' : '<p><b>No photos yet.</b> This is the one part that needs pictures from you.</p>'}`;
    const drop = el.querySelector('#rvDrop'), inp = el.querySelector('#rvFile');
    drop.addEventListener('click', () => inp.click());
    inp.addEventListener('change', () => inp.files[0] && add(inp.files[0], el));
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && add(e.dataTransfer.files[0], el));
    el.querySelectorAll('[data-id]').forEach((d) => d.addEventListener('click', (e) => { const id = +d.dataset.id; if (e.target.dataset.del) { pairs = pairs.filter((p) => p.id !== id); del(id); render(el); return; } open(pairs.find((p) => p.id === id)); }));
  }
  load();
  B.tools.add({ id: 'reality', label: 'Reality vs twin', render });
  B.reality = { open, list: () => pairs };
})();
