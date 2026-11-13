import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { STORE, fmt } from './config.js';
import { initCart } from './cart.js';
import { drawBlueprint } from './blueprint.js';
import { DEFAULT_STATE } from './three/state.js';
import { detectMode, rememberLite } from './mode.js';

/* ------------------------------------------------------------ 3D or lite? */
// One flag drives everything: <html data-mode="3d|lite"> + window.WS_MODE.
const MODE = detectMode();
window.WS_MODE = MODE;
document.documentElement.dataset.mode = MODE.mode;
const isLite = () => MODE.mode === 'lite';
function loadLitePhotos() {
  document.querySelectorAll('img[data-lite-src]').forEach((img) => { if (!img.src) img.src = img.dataset.liteSrc; });
}
if (isLite()) loadLitePhotos();
// three.js + the model load as a separate chunk — and only when the 3D will actually run
const stageModule = isLite() ? null : import('./three/stage.js');

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.innerWidth < 900;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------ static bits */
$$('[data-price]').forEach((el) => (el.textContent = fmt(STORE.product.price)));
$$('[data-reel]').forEach((el) => (el.href = STORE.instagramReel));
$('#year').textContent = new Date().getFullYear();
drawBlueprint($('#blueprint'));

/* ------------------------------------------------------------ smooth scroll */
const lenis = reduced || isLite() ? null : new Lenis({ lerp: 0.1, smoothWheel: true });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
let lockCount = 0;
const lockScroll = () => { if (lockCount++ === 0) { lenis?.stop(); document.body.classList.add('is-locked'); } };
const unlockScroll = () => { if (--lockCount <= 0) { lockCount = 0; lenis?.start(); document.body.classList.remove('is-locked'); } };

function scrollToTarget(sel) {
  const el = $(sel);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------ pause off-screen loops */
// Infinite CSS animations (beams, badge, marquee, shine, coil…) keep costing
// frames even when nobody can see them — freeze them while their section is away.
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting));
  }, { rootMargin: '100px 0px' });
  $$('main > section').forEach((s) => io.observe(s));
}

/* ------------------------------------------------------------ cart */
initCart({ lockScroll, unlockScroll });

/* ------------------------------------------------------------ nav + menu */
const nav = $('#nav'), menu = $('#menu'), burger = $('#burger');
function setMenu(open) {
  menu.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  open ? lockScroll() : unlockScroll();
}
burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-scroll]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (menu.classList.contains('is-open')) setMenu(false);
  setTimeout(() => scrollToTarget(href), menu.classList.contains('is-open') ? 300 : 0);
});

let lastY = 0;
const buybar = $('#buybar');
function onScrollUI(y) {
  nav.classList.toggle('is-scrolled', y > 30);
  const goingDown = y > lastY && y > window.innerHeight * 0.8;
  if (!menu.classList.contains('is-open')) nav.classList.toggle('is-hidden', goingDown && Math.abs(y - lastY) > 2);
  lastY = y;
  const vh = window.innerHeight;
  const nearBuy = y + vh > buyRange[0] && y < buyRange[1];
  const nearFinal = y + vh > finalTop;
  const inTour = (y > anatomyRange[0] - 50 && y < anatomyRange[1] + 50) || (y > viewerRange[0] && y < viewerRange[1]);
  buybar.classList.toggle('is-visible', y > window.innerHeight * 0.7 && !nearBuy && !nearFinal && !inTour);
}

/* ------------------------------------------------------------ 3D stage */
let stage = null;

// Switch to the photo version: on WebGL errors, a slow build, or low frame rate.
function switchToLite(reason) {
  if (isLite()) return;
  console.info('[warrior] switching to lite mode:', reason);
  MODE.mode = 'lite'; MODE.reason = reason; MODE.forced = false;
  document.documentElement.dataset.mode = 'lite';
  rememberLite(reason);
  loadLitePhotos();
  if (stage) { stage.dispose(); stage = null; }
  hotspot.style.opacity = '0';
  updateModebar();
  requestAnimationFrame(() => { measure(); onScroll(); ScrollTrigger.refresh(); });
}

// Runtime watchdog: three bad ~0.75 s windows in a row → lite. Skips the first
// seconds (shader warm-up) and never overrides a mode picked with the toggle.
function watchFrameRate() {
  const startedAt = performance.now();
  let bad = 0;
  stage.onPerf((avg, atLowestRes) => {
    if (MODE.forced || performance.now() - startedAt < 4000) return;
    const tooSlow = (atLowestRes && avg > 1 / 30) || avg > 1 / 20;
    bad = tooSlow ? bad + 1 : 0;
    if (bad >= 3) switchToLite(`low frame rate (${Math.round(1 / avg)} fps)`);
  });
}

/* dev-only toggle so the two modes can be compared — set STORE.devModeToggle = false to remove */
let modebar = null;
function updateModebar() {
  if (!modebar) return;
  const forced = MODE.forced ? MODE.mode : 'auto';
  modebar.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === forced));
  const info = modebar.querySelector('.modebar__info');
  info.textContent = `${MODE.mode === 'lite' ? 'Lite' : '3D'} · ${MODE.reason}`;
  info.title = info.textContent;
}
if (STORE.devModeToggle) {
  modebar = document.createElement('div');
  modebar.className = 'modebar';
  modebar.innerHTML = '<button data-mode="3d">3D</button><button data-mode="lite">Lite</button><button data-mode="auto">Auto</button><span class="modebar__info"></span>';
  modebar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const url = new URL(location.href);
    url.searchParams.set('mode', b.dataset.mode);
    location.href = url.toString();
  });
  document.body.appendChild(modebar);
  updateModebar();
}

const ui = { sep: 0, warm: 0 };
const STEP_FOCUS = [
  { fy: 95.5, fz: 3.4, dist: 2.1, rotY: 0.5, rotX: 0.05 }, // pommel
  { fy: 84.5, fz: 3.4, dist: 2.3, rotY: -0.45, rotX: 0.0 }, // grip
  { fy: 72.5, fz: 3.4, dist: 2.6, rotY: 0.28, rotX: -0.05 }, // guard
  { fy: 56, fz: 3.4, dist: 2.8, rotY: -0.22, rotX: 0.06 }, // etching
  { fy: 28, fz: 3.4, dist: 4.6, rotY: 0.38, rotX: 0.1 }, // blade
  { fy: 52, fz: 0, dist: 7.6, rotY: -0.55, rotX: 0 }, // plaque
];

function heroState() {
  return isMobile()
    ? { ...DEFAULT_STATE, dist: 11.2, rotY: -0.35, nx: 0.52, ny: -0.1 }
    : { ...DEFAULT_STATE, dist: 7.2, rotY: -0.42, nx: 0.42, ny: -0.02 };
}
function storyState() {
  return isMobile()
    ? { ...DEFAULT_STATE, dist: 10, rotY: 0.6, rotX: 0.05, opacity: 0 }
    : { ...DEFAULT_STATE, dist: 7.8, rotY: 0.6, rotX: 0.05, nx: -0.46 };
}
function stepState(i) {
  const m = isMobile();
  const s = STEP_FOCUS[i];
  return { ...DEFAULT_STATE, ...s, dist: s.dist * (m ? 1.35 : 1), nx: m ? 0 : -0.34, ny: m ? 0.3 : 0 };
}
function viewerState() {
  return { ...DEFAULT_STATE, rotY: -0.22, dist: isMobile() ? 14 : 11.6, ny: isMobile() ? -0.08 : -0.14 };
}

let keyframes = [];
let viewerRange = [0, 0];
let anatomyRange = [0, 1];
let buyRange = [0, 0];
let finalTop = Infinity;
function measure() {
  const vh = window.innerHeight;
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const buyEl = $('#buy');
  buyRange = [top(buyEl), top(buyEl) + buyEl.offsetHeight];
  finalTop = top($('#final'));
  const story = $('#story'), an = $('#anatomy'), vw = $('#viewer');
  const aTop = top(an), aEnd = aTop + an.offsetHeight - vh;
  const vTop = top(vw), vEnd = vTop + vw.offsetHeight - vh;
  anatomyRange = [aTop, aEnd];
  viewerRange = [vTop - vh * 0.6, vEnd + vh * 0.5];
  const kf = [[0, heroState()], [top(story) + story.offsetHeight / 2 - vh / 2, storyState()]];
  const span = aEnd - aTop;
  for (let i = 0; i < 6; i++) {
    kf.push([aTop + span * (i + 0.18) / 6, stepState(i)]);
    kf.push([aTop + span * (i + 0.82) / 6, stepState(i)]);
  }
  kf[2][0] = Math.max(kf[2][0], aTop); // first step locks in as the section pins
  kf.push([aEnd + vh * 0.4, { ...stepState(5), opacity: 0 }]);
  kf.push([vTop - vh * 0.6, { ...viewerState(), opacity: 0 }]);
  kf.push([vTop - vh * 0.05, viewerState()]);
  kf.push([vEnd, viewerState()]);
  kf.push([vEnd + vh * 0.5, { ...viewerState(), opacity: 0 }]);
  keyframes = kf;
}

function stateAt(y) {
  const kf = keyframes;
  if (!kf.length) return heroState();
  if (y <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [y0, a] = kf[i], [y1, b] = kf[i + 1];
    if (y >= y0 && y <= y1) {
      const t = smooth(clamp((y - y0) / Math.max(1, y1 - y0), 0, 1));
      const out = {};
      for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
      return out;
    }
  }
  return kf[kf.length - 1][1];
}

// anatomy cards + progress
const liteAnat = $('#liteAnat');
const cards = $$('.acard'), dots = $$('#anatomyDots li'), bar = $('#anatomyBar'), hotspot = $('#hotspot');
let activeStep = -1;
function updateAnatomy(y) {
  const [a, b] = anatomyRange;
  const p = clamp((y - a) / Math.max(1, b - a), 0, 1);
  bar.style.transform = `scaleX(${p})`;
  const idx = clamp(Math.floor(p * 6 - 0.0001), 0, 5);
  if (idx !== activeStep) {
    activeStep = idx;
    liteAnat.dataset.step = idx;
    cards.forEach((c, i) => { c.classList.toggle('is-active', i === idx); c.classList.toggle('is-past', i < idx); });
    dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
  }
  const inside = y > a - 10 && y < b + 10;
  hotspot.style.opacity = inside && stage && idx < 5 ? '1' : '0';
}

function updateStage(y) {
  if (!stage) return;
  const s = stateAt(y);
  const inViewer = y > viewerRange[0] && y < viewerRange[1];
  s.sep = inViewer ? ui.sep : 0;
  s.warm = inViewer ? ui.warm : 0;
  Object.assign(stage.target, s);
  if (!inViewer && !dragging) { drag.vel = 0; stage.extra.userRotY *= 0.9; stage.extra.userRotX *= 0.9; }
}

function onScroll() {
  const y = window.scrollY;
  onScrollUI(y);
  updateAnatomy(y);
  updateStage(y);
}

/* ------------------------------------------------------------ viewer drag */
const area = $('#viewerArea');
let dragging = false;
const drag = { x: 0, y: 0, vel: 0 };
area.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, a')) return;
  dragging = true; drag.x = e.clientX; drag.y = e.clientY; drag.vel = 0;
  $('#viewerHint').classList.add('is-hidden');
  if (e.pointerType === 'mouse') area.setPointerCapture(e.pointerId);
});
area.addEventListener('pointermove', (e) => {
  if (!dragging || !stage) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  stage.extra.userRotY += dx * 0.009;
  drag.vel = dx * 0.009;
  if (e.pointerType === 'mouse') stage.extra.userRotX = clamp(stage.extra.userRotX + dy * 0.004, -0.45, 0.45);
});
const endDrag = () => { dragging = false; };
area.addEventListener('pointerup', endDrag);
area.addEventListener('pointercancel', endDrag);
area.addEventListener('pointerleave', endDrag);

$$('[data-sep]').forEach((b) => b.addEventListener('click', () => {
  ui.sep = Number(b.dataset.sep);
  $$('[data-sep]').forEach((x) => x.classList.toggle('is-active', x === b));
  $('#liteViewer').classList.toggle('is-apart', ui.sep === 1);
  updateStage(window.scrollY);
}));
$$('[data-warm]').forEach((b) => b.addEventListener('click', () => {
  ui.warm = Number(b.dataset.warm);
  $$('[data-warm]').forEach((x) => x.classList.toggle('is-active', x === b));
  $('#viewerGlow').classList.toggle('is-on', ui.warm === 1);
  $('#liteViewer').classList.toggle('is-warm', ui.warm === 1);
  updateStage(window.scrollY);
}));
$('#viewerReset').addEventListener('click', () => {
  if (!stage) return;
  drag.vel = 0;
  gsap.to(stage.extra, { userRotY: 0, userRotX: 0, duration: 1.2, ease: 'expo.out' });
});

/* ------------------------------------------------------------ mouse parallax */
window.addEventListener('pointermove', (e) => {
  if (stage && e.pointerType === 'mouse') {
    stage.extra.mxT = (e.clientX / innerWidth) * 2 - 1;
    stage.extra.myT = (e.clientY / innerHeight) * 2 - 1;
  }
}, { passive: true });

/* ------------------------------------------------------------ frame loop hooks */
function registerFrameHooks() {
  stage.onFrame(() => {
    if (!stage) return; // switched to lite mid-frame
    const ex = stage.extra;
    ex.mx += ((ex.mxT || 0) - ex.mx) * 0.05;
    ex.my += ((ex.myT || 0) - ex.my) * 0.05;
    if (!dragging && Math.abs(drag.vel) > 0.0001) { ex.userRotY += drag.vel; drag.vel *= 0.94; }
    // hotspot follows the focused part
    if (activeStep >= 0 && activeStep < 5) {
      const s = STEP_FOCUS[activeStep];
      const p = stage.project(0, s.fy, s.fz + 1.2);
      hotspot.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  });
}
/* ------------------------------------------------------------ magnetic + tilt */
if (finePointer && !reduced) {
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      gsap.to(el, { x: x * 0.25, y: y * 0.35, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }));
  });
  $$('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ------------------------------------------------------------ buy gallery + lightbox */
const mainImg = $('#buyMainImg');
$$('#buyThumbs button').forEach((b) => b.addEventListener('click', () => {
  $$('#buyThumbs button').forEach((x) => x.classList.toggle('is-active', x === b));
  gsap.to(mainImg, { opacity: 0, duration: 0.2, onComplete: () => { mainImg.src = b.dataset.src; gsap.to(mainImg, { opacity: 1, duration: 0.4 }); } });
  $('.buy__tag').textContent = b.dataset.src.includes('studio') || b.dataset.src.includes('detail') ? 'Studio photo' : 'Styled render';
}));
const lb = $('#lightbox'), lbImg = $('#lightboxImg');
function openLightbox(src, alt) { lbImg.src = src; lbImg.alt = alt || ''; lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); lockScroll(); }
function closeLightbox() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); unlockScroll(); }
$$('[data-lightbox]').forEach((f) => f.addEventListener('click', () => openLightbox(f.dataset.lightbox, f.querySelector('img')?.alt)));
$('#buyMain').addEventListener('click', () => openLightbox(mainImg.src, mainImg.alt));
lb.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLightbox(); });

// single-open accordions
$$('[data-acc]').forEach((acc) => {
  acc.addEventListener('toggle', (e) => {
    if (e.target.open) $$('details', acc).forEach((d) => { if (d !== e.target) d.open = false; });
  }, true);
});

/* ------------------------------------------------------------ text splitting */
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((w) =>
    `<span class="split-word" aria-hidden="true">${[...w].map((c) => `<span class="split-char">${c}</span>`).join('')}</span>`).join(' ');
  return $$('.split-char', el);
}
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.append(part);
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s); }
        });
        n.replaceWith(frag);
      } else walk(n);
    });
  };
  walk(el);
  return $$('.w', el);
}

/* ------------------------------------------------------------ scroll animations */
function setupAnimations() {
  // story words light up as you read
  const words = splitWords($('[data-words]'));
  let litWords = words.length; // all words start fully visible until the trigger updates
  ScrollTrigger.create({
    trigger: '#story', start: 'top 70%', end: 'bottom 60%', scrub: true,
    onUpdate: (st) => {
      const n = Math.min(words.length, Math.floor(st.progress * words.length * 1.15));
      if (n === litWords) return;
      const [a, b] = n > litWords ? [litWords, n] : [n, litWords];
      for (let i = a; i < b; i++) words[i].style.opacity = i < n ? 1 : 0.12;
      litWords = n;
    },
  });

  // counters
  $$('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }),
    });
  });

  // generic reveals
  const groups = ['.section-head', '.dims__info > *', '.spec > div', '.buy__info > *', '.faq__grid > div > *', '.acc--faq details', '.footer__grid > *', '.gallery__head > *'];
  groups.forEach((sel) => {
    $$(sel).forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });
  });
  $$('.tile').forEach((el, i) => {
    gsap.from(el, { y: 80, opacity: 0, rotateX: -12, duration: 1.3, delay: (i % 3) * 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 95%' } });
  });
  gsap.from('.buy__main', { clipPath: 'inset(12% 12% 12% 12% round 40px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.buy__main', start: 'top 85%' } });

  // blueprint drawing
  gsap.to('#blueprint .bp-draw', {
    strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', stagger: 0.08,
    scrollTrigger: { trigger: '#dimensions', start: 'top 65%' },
  });
  gsap.from('#blueprint .bp-dimg', {
    opacity: 0, duration: 0.8, stagger: 0.12, delay: 0.8, ease: 'power2.out',
    scrollTrigger: { trigger: '#dimensions', start: 'top 65%' },
  });

  // final title
  const finalChars = splitChars($('.final__title'));
  gsap.from(finalChars, {
    yPercent: 110, rotate: 6, duration: 1.2, stagger: 0.03, ease: 'expo.out',
    scrollTrigger: { trigger: '.final', start: 'top 70%' },
  });
  gsap.fromTo('.footer__mega', { yPercent: 40 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  // horizontal gallery (pinned on tablet/desktop; native swipe on phones)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 601px)', () => {
    const track = $('#galleryTrack');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.gallery', start: 'top top', end: () => '+=' + dist(), pin: '.gallery__pin', scrub: 0.6, invalidateOnRefresh: true },
    });
    $$('.gcard img', track).forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    return () => tween.kill();
  });

  // marquee speeds up with scroll velocity
  const track = $('.marquee__track');
  let marqueeDur = 32;
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (st) => {
      const d = Math.round(clamp(32 - Math.abs(st.getVelocity()) / 120, 10, 32));
      if (d !== marqueeDur) { marqueeDur = d; track.style.animationDuration = `${d}s`; }
    },
  });
}

/* ------------------------------------------------------------ intro */
function intro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  const chars = $$('.hero [data-split]').flatMap(splitChars);
  tl.to('#loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
    .from('.hero__the', { y: 30, opacity: 0, duration: 1 }, '-=0.35')
    .from(chars, { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.035 }, '<0.05')
    .from(['.hero__eyebrow', '.hero__sub', '.hero__buy', '.hero__facts'], { y: 30, opacity: 0, duration: 1.1, stagger: 0.08 }, '-=1.0')
    .from(['.nav', '.hero__scroll', '.hero__badge'], { opacity: 0, duration: 1 }, '<')
    .from('.hero__ring', { scale: 0.6, opacity: 0, duration: 2 }, '<-0.4')
    .add(() => { $('#loader').remove(); lenis?.start(); });
}

/* ------------------------------------------------------------ boot */
async function boot() {
  const bar = $('#loaderBar'), pct = $('#loaderPct');
  const setP = (p) => { bar.style.transform = `scaleX(${p})`; pct.textContent = String(Math.round(p * 100)).padStart(2, '0'); };
  setP(0.2);
  // build the 3D scene while the fonts load (nothing on screen waits on the lazy photos)
  const TOO_SLOW = 9000; // a device that needs longer than this to build the scene won't run it well
  const stageReady = !stageModule ? Promise.resolve(null) : Promise.race([
    stageModule.then(({ createStage }) => createStage($('#stage'), { mobile: isMobile() })),
    new Promise((_, rej) => setTimeout(() => rej(new Error('3D took too long to load')), TOO_SLOW)),
  ]).then(
    (s) => { setP(0.85); return s; },
    (err) => { switchToLite(err?.message?.includes('too long') ? '3D took too long to load' : 'WebGL error'); return null; },
  );
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  setP(0.55);
  stage = await stageReady;
  if (stage && isLite()) { stage.dispose(); stage = null; } // finished after the timeout fired
  if (isLite()) await Promise.race([$('.lite-hero img').decode?.().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  if (stage) { registerFrameHooks(); watchFrameRate(); }
  measure();
  if (stage) {
    // start offstage-ish so the model glides in
    Object.assign(stage.target, stateAt(window.scrollY));
    stage.snap();
    stage.current.opacity = 0;
    stage.current.dist += 3;
    stage.current.rotY -= 1.2;
    stage.renderOnce();
    stage.start();
  }
  setupAnimations();
  setP(1);
  await new Promise((r) => setTimeout(r, 350));
  intro();
  onScroll();
  ScrollTrigger.refresh();
}

window.addEventListener('scroll', onScroll, { passive: true });
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { measure(); onScroll(); ScrollTrigger.refresh(); }, 150);
});
ScrollTrigger.addEventListener('refresh', () => { measure(); onScroll(); });

boot();
