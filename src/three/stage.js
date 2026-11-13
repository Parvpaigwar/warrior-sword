// Fixed full-screen WebGL stage. Scroll code sets `target`; the loop eases
// `current` toward it so every transition stays buttery.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildProduct, TIP_ON_PLAQUE, SWORD_Z } from './model.js';
import { DEFAULT_STATE } from './state.js';

export { DEFAULT_STATE };

export async function createStage(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Full pixel ratio on capable GPUs; the frame-time governor below only steps it
  // down on devices that genuinely can't keep up (and steps back up when they can).
  const maxDpr = Math.min(window.devicePixelRatio, mobile ? 1.75 : 2);
  const minDpr = Math.min(maxDpr, 1);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d2c8, 0.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3.5, 4.5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe6cc, 1.4);
  rim.position.set(4, 2, -4);
  scene.add(rim);
  const ember = new THREE.PointLight(0xff9a50, 0, 12, 1.6);
  ember.position.set(2.2, 1.5, 2.5);
  scene.add(ember);

  const { root, swordPivot } = await buildProduct(renderer, mobile ? 0.75 : 1.25);
  scene.add(root);
  const inner = root.children[0];

  const target = { ...DEFAULT_STATE };
  const current = { ...DEFAULT_STATE };
  const extra = { userRotY: 0, userRotX: 0, mx: 0, my: 0 };

  const studioKey = new THREE.Color(0xffffff);
  const warmKey = new THREE.Color(0xffb36b);

  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Compile every shader up front without blocking the main thread
  // (KHR_parallel_shader_compile), so the first frames and the intro stay smooth.
  try { await renderer.compileAsync(scene, camera); } catch { /* falls back to lazy compile */ }

  // adaptive resolution governor
  let acc = 0, frames = 0, slowWindows = 0, fastWindows = 0;
  const perfListeners = [];
  function govern(dt) {
    acc += dt; frames++;
    if (frames < 45) return;
    const avg = acc / frames; acc = 0; frames = 0;
    perfListeners.forEach((fn) => fn(avg, dpr <= minDpr));
    if (avg > 0.024) { fastWindows = 0; if (++slowWindows >= 2 && dpr > minDpr) { dpr = Math.max(minDpr, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); slowWindows = 0; } }
    else if (avg < 0.0175) { slowWindows = 0; if (++fastWindows >= 6 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.25); renderer.setPixelRatio(dpr); resize(); fastWindows = 0; } }
    else { slowWindows = 0; fastWindows = 0; }
  }

  const focusLocal = new THREE.Vector3();
  const focusWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function apply(time) {
    const s = current;
    // sword lifts off the wall and swings to the side
    swordPivot.position.set(16 * s.sep, TIP_ON_PLAQUE + 4 * s.sep, SWORD_Z + 9 * s.sep);
    swordPivot.rotation.set(0, -0.35 * s.sep, -0.08 * s.sep);

    const sway = Math.sin(time * 0.35) * 0.06 * (1 - Math.abs(s.sep - 0.5));
    root.rotation.set(s.rotX + extra.userRotX + extra.my * 0.05, s.rotY + extra.userRotY + sway + extra.mx * 0.12, 0);
    root.updateMatrixWorld(true);

    focusLocal.set(s.fx + s.sep * 8, s.fy, s.fz);
    focusWorld.copy(focusLocal);
    inner.localToWorld(focusWorld);

    camera.position.set(focusWorld.x, focusWorld.y, focusWorld.z + s.dist);
    camera.lookAt(focusWorld);
    camera.setViewOffset(W, H, -s.nx * W / 2, s.ny * H / 2, W, H);

    key.color.copy(studioKey).lerp(warmKey, s.warm);
    key.intensity = 2.4 + s.warm * 0.8;
    ember.intensity = s.warm * 6;
    hemi.intensity = 0.6 - s.warm * 0.25;
    scene.environmentIntensity = 0.9 - s.warm * 0.25;
    canvas.style.opacity = s.opacity.toFixed(3);
  }

  let last = performance.now();
  let running = true;
  const listeners = [];
  function loop(now) {
    if (!running) return;
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    const k = 1 - Math.exp(-dt * 5.5);
    for (const key2 in target) current[key2] += (target[key2] - current[key2]) * k;
    if (target.opacity === 0 && current.opacity < 0.01) current.opacity = 0;
    if (current.opacity > 0.002) {
      apply(now / 1000);
      renderer.render(scene, camera);
      if (raw < 0.25) govern(raw); // ignore tab switches / hitches
    } else {
      canvas.style.opacity = '0';
    }
    listeners.forEach((fn) => fn());
    requestAnimationFrame(loop);
  }

  return {
    target, current, extra, renderer,
    start() { requestAnimationFrame(loop); },
    renderOnce() { apply(0); renderer.render(scene, camera); },
    snap() { Object.assign(current, target); },
    onFrame(fn) { listeners.push(fn); },
    // called every ~45 rendered frames with (average frame time in s, already at lowest resolution?)
    onPerf(fn) { perfListeners.push(fn); },
    // project a product-space point (cm) to CSS pixels
    project(x, y, z) {
      tmp.set(x, y, z);
      inner.localToWorld(tmp);
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, visible: tmp.z < 1 };
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
