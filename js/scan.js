/* Building 100 - scan a location or material label with the phone camera and jump to it in the model */
(function () {
  const B = window.B100, P = B.panel;
  const CODE = /([A-N])\W?0?(\d{1,2})\W?([1-5])\W?([12])/i;
  let stream = null, timer = null, detector = null, jsqr = null;

  const css = document.createElement('style');
  css.textContent = `.scan { position: fixed; inset: 0; z-index: 40; background: rgba(8,12,16,0.72); display: grid; place-items: center; padding: 16px; }
    .scan .box { width: min(440px, 100%); background: var(--surface); border-radius: 16px; padding: 16px; display: grid; gap: 12px; box-shadow: var(--shadow); }
    .scan h3 { margin: 0; font: 700 17px var(--f-display); } .scan p { margin: 0; color: var(--muted); font-size: 13px; }
    .scan .view { position: relative; aspect-ratio: 4 / 3; background: #0b0f13; border-radius: 12px; overflow: hidden; }
    .scan video { width: 100%; height: 100%; object-fit: cover; }
    .scan .aim { position: absolute; inset: 22% 14%; border: 3px solid var(--accent-strong); border-radius: 12px; box-shadow: 0 0 0 999px rgba(0,0,0,0.35); }
    .scan .line { position: absolute; left: 14%; right: 14%; height: 2px; background: #ff3b30; top: 50%; animation: scanline 1.6s ease-in-out infinite alternate; }
    @media (max-width: 760px) { #scanBtn span, #alertBtn span { display: none; } }
    @keyframes scanline { from { top: 24%; } to { top: 76%; } }
    .scan form { display: flex; gap: 8px; } .scan input { flex: 1; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); font: 600 15px var(--f-mono); }`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'scanBtn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg><span>Scan a label</span>';
  document.getElementById('alertBtn').before(btn);

  const ov = document.createElement('div');
  ov.className = 'scan'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Scan a label');
  ov.innerHTML = `<div class="box"><h3>Scan a label</h3><p id="scMsg">Point the camera at a rack location label (like C-07-3-1) or a material barcode.</p>
    <div class="view"><video id="scVid" playsinline muted></video><div class="aim"></div><div class="line"></div></div>
    <form id="scForm"><input id="scIn" placeholder="Or type the code: C-07-3-1" aria-label="Location or material code" autocomplete="off"><button class="btn primary">Find</button></form>
    <button class="btn" id="scClose">Close</button></div>`;
  document.body.appendChild(ov);
  const $ = (id) => document.getElementById(id);

  // a scanned text: location code, material number or any search word
  function resolve(raw) {
    const txt = String(raw).trim();
    if (!txt) return false;
    const m = txt.toUpperCase().match(CODE);
    if (m) {
      const code = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3] + '-' + m[4];
      const s = B.SLOTS.find((q) => q.code === code);
      if (s) { close(); B.ui.focusSlot(s); B.tools.toast('Scanned ' + code); return true; }
    }
    const digits = txt.replace(/\D/g, '');
    const it = digits.length >= 6 && B.ITEMS.find((q) => q.mat.replace(/\D/g, '') === digits);
    if (it) {
      close();
      const s = B.SLOTS.filter((q) => q.item === it.i).sort((a, b) => a.level - b.level)[0];
      if (s) B.ui.focusSlot(s);
      const q = $('q'); q.value = it.name; P.renderSearch(it.name);
      B.tools.toast('Scanned material ' + it.mat + ': ' + it.name);
      return true;
    }
    const res = B.search(txt);
    if (res.slots.length || res.materials.length) { close(); const q = $('q'); q.value = txt; P.renderSearch(txt); return true; }
    $('scMsg').textContent = 'No location or material matches "' + txt + '". Try again.';
    return false;
  }

  function loadJsQR() {
    return new Promise((res, rej) => {
      if (window.jsQR) return res(window.jsQR);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = () => res(window.jsQR); s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function open() {
    ov.hidden = false;
    $('scMsg').textContent = 'Point the camera at a rack location label (like C-07-3-1) or a material barcode.';
    setTimeout(() => $('scIn').focus(), 50);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('scMsg').textContent = 'This browser has no camera access here. Type the code instead, or open the public site on your phone.'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    } catch (e) { $('scMsg').textContent = 'Camera not available (' + (e.name === 'NotAllowedError' ? 'permission refused' : 'no camera') + '). Type the code below instead.'; return; }
    const v = $('scVid');
    v.srcObject = stream; await v.play().catch(() => {});
    if ('BarcodeDetector' in window) {
      try { detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'] }); } catch (e) { detector = null; }
    }
    if (!detector) jsqr = await loadJsQR().catch(() => null);
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
    timer = setInterval(async () => {
      if (!v.videoWidth) return;
      try {
        if (detector) { const r = await detector.detect(v); if (r[0]) resolve(r[0].rawValue); return; }
        if (jsqr) {
          c.width = v.videoWidth / 2; c.height = v.videoHeight / 2; ctx.drawImage(v, 0, 0, c.width, c.height);
          const r = jsqr(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          if (r && r.data) resolve(r.data);
        }
      } catch (e) {}
    }, 350);
  }
  function close() {
    ov.hidden = true;
    clearInterval(timer); timer = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  btn.addEventListener('click', open);
  $('scClose').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden) close(); });
  $('scForm').addEventListener('submit', (e) => { e.preventDefault(); resolve($('scIn').value); });
  B.scan = { open, close, resolve };
})();
