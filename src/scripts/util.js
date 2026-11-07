export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => [...c.querySelectorAll(s)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
export const state = { lenis: null, playerOpen: false };

// run cb once the loader / transition has released the page
export function whenReady(cb) {
  const b = document.body;
  if (!b.classList.contains('is-loading')) return cb();
  const mo = new MutationObserver(() => { if (!b.classList.contains('is-loading')) { mo.disconnect(); cb(); } });
  mo.observe(b, { attributes: true, attributeFilter: ['class'] });
}

// load the YouTube IFrame API once
let ytQ = [], ytLoading = false;
export function loadYT(cb) {
  if (window.YT && window.YT.Player) return cb();
  ytQ.push(cb);
  if (ytLoading) return;
  ytLoading = true;
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (prev) prev(); ytQ.splice(0).forEach(f => f()); };
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
}
