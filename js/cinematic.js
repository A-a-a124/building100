/* Building 19 - cinematic effects: light bloom and a glossier floor in Present and Photo modes, or always with the layer switch */
(function () {
  const B = window.B100, W = B.world, T = THREE;
  const { renderer, scene, camera, stage } = B.three;
  if (/[?&]capture/.test(location.search)) return;
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
  const FILES = ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/ACESFilmicToneMappingShader.js', 'shaders/GammaCorrectionShader.js', 'postprocessing/EffectComposer.js', 'postprocessing/Pass.js', 'postprocessing/ShaderPass.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js'];
  let composer = null, loading = null, on = false, bloom = null;
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = CDN + src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  function ensure() {
    if (!loading) loading = FILES.reduce((p, f) => p.then(() => load(f).catch(() => {})), Promise.resolve()).then(() => {
      if (!T.EffectComposer || !T.UnrealBloomPass) return;
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      const RT = T.WebGLMultisampleRenderTarget || T.WebGLRenderTarget, rt = new RT(size.x, size.y, { type: T.HalfFloatType, format: T.RGBAFormat, encoding: T.LinearEncoding });
      rt.samples = 4;
      composer = new T.EffectComposer(renderer, rt);
      composer.addPass(new T.RenderPass(scene, camera));
      composer.addPass(new T.ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r >= 0.0) || !(c.g >= 0.0) || !(c.b >= 0.0)) c.rgb = vec3(0.0); c.rgb = min(c.rgb, vec3(24.0)); gl_FragColor = c; }' }));
      bloom = new T.UnrealBloomPass(new T.Vector2(size.x, size.y), 0.16, 0.4, 1.0);
      composer.addPass(bloom);
      composer.addPass(new T.ShaderPass(T.ACESFilmicToneMappingShader));
      composer.addPass(new T.ShaderPass(T.GammaCorrectionShader));
      composer.addPass(new T.ShaderPass({ uniforms: { tDiffuse: { value: null }, px: { value: new T.Vector2(1 / size.x, 1 / size.y) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 px; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 nb = (texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb) * 0.25; c.rgb = clamp(c.rgb + (c.rgb - nb) * 0.24, 0.0, 1.0); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, 1.14); c.rgb = (c.rgb - 0.5) * 1.06 + 0.5; gl_FragColor = c; }' }));
    });
    return loading;
  }
  // the app calls renderer.render every frame: while effects are on, route the main scene through the composer
  const plain = renderer.render.bind(renderer);
  let inside = false;
  renderer.render = function (s, c) {
    if (!on || !composer || inside || s !== scene || c !== camera) return plain(s, c);
    inside = true;
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    if (composer.renderTarget1.width !== size.x || composer.renderTarget1.height !== size.y) composer.setSize(size.x / renderer.getPixelRatio(), size.y / renderer.getPixelRatio()), composer.setPixelRatio(renderer.getPixelRatio());
    const tm = renderer.toneMapping; renderer.toneMapping = T.NoToneMapping;
    composer.passes[3].uniforms.exposure.value = renderer.toneMappingExposure; composer.passes[5].uniforms.px.value.set(1 / size.x, 1 / size.y);
    composer.render();
    renderer.toneMapping = tm;
    inside = false;
  };
  // a glossier floor while effects are on
  function floor(v) { const m = W.floor.material; m.roughness = v ? 0.38 : 0.62; m.envMapIntensity = v ? 0.9 : m.envMapIntensity; m.needsUpdate = true; }
  async function set(v) {
    if (v) await ensure();
    on = v && !!composer; floor(on);
  }
  // Present and Photo modes switch it on for their duration; the layer switch keeps it on
  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyCine">Cinematic effects</label>');
  const box = document.getElementById('lyCine');
  box.parentElement.hidden = !layers.querySelector('label:not([hidden])');
  box.addEventListener('change', () => set(box.checked));
  new MutationObserver(() => { const low = document.getElementById('lyLow'); const want = box.checked || (document.body.classList.contains('cine') && !(low && low.checked)); if (want !== on) set(want); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  B.cinematic = { set, isOn: () => on };
})();
