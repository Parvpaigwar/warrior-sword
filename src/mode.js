// Decides whether this device gets the real-time 3D experience or the
// lightweight photo version ("lite").
//
// The flag lives on <html data-mode="3d|lite"> and window.WS_MODE, so CSS and
// JS can both branch on it. Order of decisions:
//   1. ?mode=3d | lite | auto in the URL (dev toggle — remembered in localStorage)
//   2. a lite fallback already triggered earlier in this browser session
//   3. up-front device checks (no WebGL, software/weak GPU, low memory, data saver…)
//   4. at runtime main.js can still call switchToLite() if frames drop too low.

const FORCE_KEY = 'ws-mode-force';
const AUTO_KEY = 'ws-lite-reason';

const store = (s, fn) => { try { return fn(s); } catch { return null; } };

// GPUs known to be too weak for the full-screen physically-based render. Mid-range
// integrated GPUs (e.g. Intel UHD 6xx) are NOT listed — they usually cope, and
// the runtime frame-rate watchdog in main.js catches the ones that don't.
const WEAK_GPU = new RegExp([
  'swiftshader', 'llvmpipe', 'softpipe', 'software', 'microsoft basic render',
  'mali-[24]\\d\\d', 'mali-t\\d', 'adreno \\(tm\\) ?[2-4]\\d\\d', 'adreno \\(tm\\) ?50\\d',
  'powervr sgx', 'intel.*gma', 'intel\\(r\\) hd graphics [2-5]\\d{3}\\b', 'intel\\(r\\) hd graphics$',
].join('|'), 'i');

function probeGPU() {
  try {
    const c = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true };
    const gl = c.getContext('webgl2', opts) || c.getContext('webgl', opts);
    if (!gl) return { ok: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, name };
  } catch { return { ok: false }; }
}

function deviceLiteReason() {
  const nav = navigator;
  if (nav.connection?.saveData) return 'data saver is on';
  const mem = nav.deviceMemory; // Chrome/Android only (GB, rounded)
  const cores = nav.hardwareConcurrency || 8;
  const touch = matchMedia('(pointer: coarse)').matches;
  if (mem && mem < 4) return `low memory (${mem} GB)`;
  if (cores <= 2) return `few CPU cores (${cores})`;
  if (touch && mem && mem <= 4) return `budget phone (${mem} GB)`;
  const gpu = probeGPU();
  if (!gpu.ok) return 'no hardware WebGL';
  if (WEAK_GPU.test(gpu.name)) return `entry-level GPU (${gpu.name.replace(/^ANGLE \(|\)$/g, '').slice(0, 60)})`;
  return null;
}

export function detectMode() {
  const q = new URLSearchParams(location.search).get('mode');
  if (q === '3d' || q === 'lite') store(localStorage, (s) => s.setItem(FORCE_KEY, q));
  if (q === 'auto') {
    store(localStorage, (s) => s.removeItem(FORCE_KEY));
    store(sessionStorage, (s) => s.removeItem(AUTO_KEY));
  }
  const forced = store(localStorage, (s) => s.getItem(FORCE_KEY));
  if (forced === '3d' || forced === 'lite') return { mode: forced, forced: true, reason: 'set with the toggle' };

  const earlier = store(sessionStorage, (s) => s.getItem(AUTO_KEY));
  if (earlier) return { mode: 'lite', forced: false, reason: earlier };

  const reason = deviceLiteReason();
  return reason ? { mode: 'lite', forced: false, reason } : { mode: '3d', forced: false, reason: 'capable device' };
}

// Remember a runtime fallback for the rest of the session (no 3D flash on reload).
export function rememberLite(reason) {
  store(sessionStorage, (s) => s.setItem(AUTO_KEY, reason));
}
