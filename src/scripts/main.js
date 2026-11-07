// RD Studio — site script. Page-aware: every block checks that its elements exist, so one bundle serves every page.
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { $, $$, lerp, clamp, reduce, fine, state, whenReady } from './util.js';
import { initPlayer, initPreviews } from './player.js';
import { CODES } from '../data/codes.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
const root = document.documentElement, body = document.body;
const FIRST = root.classList.contains('first');
const WIPE_IN = root.classList.contains('wipe-on');
const store = {
  get: k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} },
  del: k => { try { sessionStorage.removeItem(k); } catch (_) {} }
};
let CUR = store.get('rd-cur') || 'USD';

/* ---------- text splitting ---------- */
function splitLetters() {
  $$('[data-split]').forEach(el => {
    const off = +el.dataset.offset || 0;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = [...el.dataset.split].map((c, i) => `<span class="ch" style="--i:${i + off}">${c === ' ' ? '\u00A0' : c}</span>`).join('');
  });
}
function splitWords() {
  const el = $('[data-words]'); if (!el) return;
  el.setAttribute('aria-label', el.textContent);
  const out = [];
  el.childNodes.forEach(n => {
    const red = n.nodeType === 1 && n.classList.contains('r');
    n.textContent.split(/\s+/).filter(Boolean).forEach(w => out.push(`<span class="w${red ? ' r' : ''}" aria-hidden="true">${w}</span>`));
  });
  el.innerHTML = out.join(' ');
}

/* ---------- smooth scroll (Lenis), driven by GSAP's ticker so ScrollTrigger stays in sync ---------- */
function smoothScroll() {
  if (reduce) return;
  const lenis = new Lenis({
    lerp: .1, wheelMultiplier: .95, smoothWheel: true, autoRaf: false, anchors: false,
    prevent: node => node.tagName === 'TEXTAREA' && node.scrollHeight > node.clientHeight + 1   // only a textarea that really scrolls keeps the wheel
  });
  state.lenis = lenis; window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  const sync = () => {
    const lock = body.classList.contains('is-loading') || body.classList.contains('menu-open') || body.classList.contains('player-open');
    lock ? lenis.stop() : lenis.start();
  };
  new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] });
  sync();
}
const scrollTo = (target, opts = {}) => state.lenis
  ? state.lenis.scrollTo(target, Object.assign({ duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4), force: true }, opts))
  : (typeof target === 'number' ? window.scrollTo({ top: target, behavior: opts.immediate ? 'instant' : 'smooth' }) : target.scrollIntoView({ behavior: opts.immediate ? 'instant' : 'smooth' }));

/* ---------- boot: first-visit loader, or hand-off from a page transition ---------- */
function boot() {
  const wipe = $('.wipe');
  const wipeOut = () => {
    store.del('rd-wipe');
    wipe.style.transition = 'none'; root.classList.remove('wipe-on'); wipe.className = 'wipe in'; void wipe.offsetHeight;
    wipe.style.transition = ''; wipe.className = 'wipe out';
    setTimeout(() => { wipe.style.transition = 'none'; wipe.className = 'wipe'; void wipe.offsetHeight; wipe.style.transition = ''; }, 750);
  };
  const release = () => {
    if (WIPE_IN) wipeOut();
    body.classList.remove('is-loading'); store.set('rd-seen', '1');
    if (location.hash.length > 1) { try { const t = $(location.hash); if (t) setTimeout(() => scrollTo(t, { immediate: true }), 60); } catch (_) {} }   // /#work from another page
  };
  const fonts = Promise.race([document.fonts ? document.fonts.ready : 0, new Promise(r => setTimeout(r, 2500))]);
  if (!FIRST) { fonts.then(() => requestAnimationFrame(release)); return; }
  const count = $('#count'), bar = $('.loader__bar b'), dur = reduce ? 200 : 1300, t0 = performance.now();
  const anim = new Promise(res => {
    (function tick(now) {
      const t = clamp((now - t0) / dur), p = 1 - Math.pow(1 - t, 3);
      count.textContent = String(Math.round(p * 100)).padStart(3, '0'); bar.style.transform = `scaleX(${p})`;
      t < 1 ? requestAnimationFrame(tick) : setTimeout(res, 200);
    })(t0);
  });
  Promise.all([anim, fonts]).then(release);
}

/* ---------- page transitions: red wipe between real pages ---------- */
function transitions() {
  const wipe = $('.wipe'); let busy = false;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    let u; try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) {          // same page: smooth in-page scroll
      e.preventDefault();
      if (!u.hash) return scrollTo(0);
      try { const t = $(u.hash); if (t) scrollTo(t); } catch (_) {}
      return;
    }
    e.preventDefault(); if (busy) return; busy = true;
    store.set('rd-wipe', '1'); wipe.className = 'wipe in';
    setTimeout(() => { location.href = u.href; }, reduce ? 0 : 650);
  });
  addEventListener('pageshow', e => { if (e.persisted) { busy = false; wipe.className = 'wipe'; store.del('rd-wipe'); } });   // back button (bfcache)
}

/* ---------- custom cursor (lerped, disabled on touch) ---------- */
function cursor() {
  if (!fine) return;
  const el = $('.cursor'), label = $('.cursor__label');
  const EXPAND = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, seen = false;
  body.classList.add('has-cursor');
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; if (!seen) { seen = true; cx = x; cy = y; } el.classList.add('on'); }, { passive: true });
  root.addEventListener('mouseleave', () => el.classList.remove('on'));
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-cursor]');
    el.classList.remove('is-link', 'is-view', 'is-band', 'is-hot'); body.classList.remove('in-band');
    if (!t) return;
    const k = t.dataset.cursor;
    if (k === 'link') return el.classList.add('is-link');
    label.textContent = k;
    if (t.dataset.cursorIcon === 'expand') label.insertAdjacentHTML('beforeend', EXPAND);
    if (t.dataset.cursorStyle === 'band') { el.classList.add('is-band'); body.classList.add('in-band'); } else el.classList.add('is-view');
  });
  const band = $('.band');
  if (band) band.addEventListener('click', e => { if (!e.target.closest('a')) $('a', band).click(); });
  (function loop() { cx = lerp(cx, x, .18); cy = lerp(cy, y, .18); el.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })();
}

/* ---------- hero: letters drift with the pointer ---------- */
function hero() {
  if (reduce || !fine) return;
  const h = $('.hero'); if (!h) return;
  const chars = $$('.ch', h);
  let mx = 0, my = 0, tx = 0, ty = 0, visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(h);
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  (function loop() {
    if (visible && innerWidth > 820) {
      tx = lerp(tx, mx, .06); ty = lerp(ty, my, .06);
      chars.forEach((c, i) => { const d = ((i * 5) % 7 + 1) / 7; c.style.translate = `${(tx * 40 * d).toFixed(1)}px ${(ty * 16 * d).toFixed(1)}px`; });
    }
    requestAnimationFrame(loop);
  })();
}

/* ---------- scroll effects ---------- */
function scrollFx() {
  const heroEl = $('.hero'), stmt = $('[data-words]'), words = stmt ? $$('.w', stmt) : [], intro = $('.intro');
  if (!heroEl && !stmt) return;
  let queued = false;
  const update = () => {
    queued = false; const vh = innerHeight;
    if (heroEl) heroEl.style.setProperty('--p', clamp(scrollY / vh).toFixed(3));
    if (stmt) {
      const pinned = intro && getComputedStyle(intro.firstElementChild).position === 'sticky';
      let n;
      if (pinned) {                                   // desktop: the intro is pinned; scroll progress through it lights the words
        const r = intro.getBoundingClientRect(), p = clamp(-r.top / (r.height - vh));
        intro.style.setProperty('--ip', p.toFixed(3));
        n = reduce ? words.length : Math.ceil(clamp(p * 1.25) * words.length);
      } else {
        const r = stmt.getBoundingClientRect();
        n = reduce ? words.length : Math.floor(clamp((vh * .95 - r.top) / (vh * .7)) * words.length * 1.05);
      }
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update); update();
}
function reveals() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .2, rootMargin: '0px 0px -8% 0px' });
  // observe parents, never an element that is itself clipped to nothing (Chrome reports it as not visible)
  $$('.hp,.intro__pin,.mi,.hproc,.contact,.band,.field,.tc,.founder').forEach(el => io.observe(el));
}
function magnetic() {
  if (!fine || reduce) return;
  $$('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.translate = `${(e.clientX - r.left - r.width / 2) * .3}px ${(e.clientY - r.top - r.height / 2) * .3}px`; });
    el.addEventListener('pointerleave', () => (el.style.translate = ''));
  });
}

/* ---------- nav adapts to the page and section ---------- */
function nav() {
  const n = $('.nav'), links = $$('.nav nav a, .menu a'), c = $('#contact');
  const secs = ['intro', 'work', 'specialization', 'hire', 'offers', 'contact'].map(id => $('#' + id)).filter(Boolean);
  const path = location.pathname.replace(/\/$/, '') || '/';
  let q = false, lastY = scrollY, hidden = false;
  const run = () => {
    q = false;
    const y = scrollY, dy = y - lastY;
    if (y < 80 || body.classList.contains('menu-open')) hidden = false;
    else if (dy > 6) hidden = true;        // scrolling down: tuck the nav away
    else if (dy < -6) hidden = false;      // scrolling up: bring it back
    if (Math.abs(dy) > 6 || y < 80) lastY = y;
    n.style.setProperty('--nav-y', hidden ? '-110%' : '0%');
    const mid = innerHeight * .5; let cur = '';
    secs.forEach(s => { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = s.id; });
    links.forEach(a => {
      const u = new URL(a.href), hp = u.pathname.replace(/\/$/, '') || '/'; let on = false;
      if (path === '/about') on = hp === '/about';
      else if (path.startsWith('/work/')) on = u.hash === '#work';
      else if (path === '/') on = u.hash ? u.hash === '#' + cur : (hp === '/' && cur === '');
      a.classList.toggle('on', on);
    });
    const red = cur === 'contact';
    n.classList.toggle('on-red', red); body.classList.toggle('on-red', red);
    root.style.setProperty('--sp', clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)).toFixed(4));
    const nh = n.offsetHeight, top = c ? c.getBoundingClientRect().top : 1e9;
    n.style.transform = `translate3d(0,${Math.max(-nh, Math.min(0, top - nh))}px,0)`;
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', run); run();
}
function spec() {
  const s = $('.spec'); if (!s) return;
  const items = $$('.spec__item', s), num = $('#sN'); let q = false;
  const run = () => {
    q = false;
    const r = s.getBoundingClientRect(), p = clamp(-r.top / (r.height - innerHeight)), started = r.top < innerHeight * .5;
    const i = Math.min(items.length - 1, Math.floor(p * items.length));
    s.dataset.i = i; s.style.setProperty('--p', p.toFixed(3)); num.textContent = '0' + (i + 1);
    items.forEach((el, k) => { el.classList.toggle('on', started && k === i); el.classList.toggle('past', k < i); });
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', run); run();
}
function fitContact() {
  const hs = $$('.contact__h'); if (!hs.length) return;
  const run = () => hs.forEach(h => {
    if (!h.offsetParent) return;
    h.style.fontSize = '100px'; let fs = 1e9;
    $$('.line', h).forEach(l => {
      const c = $$('.ch', l), w = c[c.length - 1].offsetLeft + c[c.length - 1].offsetWidth - c[0].offsetLeft;
      const pad = parseFloat(getComputedStyle(l).paddingLeft) + (l.classList.contains('line--2') ? innerWidth * .04 : 0);
      fs = Math.min(fs, 100 * (h.clientWidth - pad) / w);
    });
    h.style.fontSize = Math.min(fs * (innerWidth < 820 ? .88 : .97), innerWidth * (innerWidth < 820 ? .24 : .14)).toFixed(1) + 'px';
  });
  run(); addEventListener('resize', run);
  if (document.fonts) document.fonts.ready.then(run);
  addEventListener('load', run);
}
function fitHero() {
  const t = $('.hero__title'); if (!t) return;
  const run = () => {
    if (innerWidth > 820) { t.style.fontSize = ''; return; }
    t.style.fontSize = '100px'; let fs = 1e9;
    $$('.line', t).forEach(l => { const a = l.firstElementChild, z = l.lastElementChild, w = z.offsetLeft + z.offsetWidth - a.offsetLeft; if (w > 0) fs = Math.min(fs, 100 * t.clientWidth / w); });
    t.style.fontSize = fs < 1e9 ? (fs * .9).toFixed(1) + 'px' : '';
  };
  run(); addEventListener('resize', run);
  if (document.fonts) document.fonts.ready.then(run);
  addEventListener('load', run);
}
function menu() {
  const btn = $('#menuBtn'), panel = $('#menuPanel'); if (!btn) return;
  const set = open => {
    panel.classList.toggle('open', open); body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) $('a', panel).focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => set(!panel.classList.contains('open')));
  $$('a', panel).forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  addEventListener('resize', () => { if (innerWidth > 820) set(false); });
}

/* ---------- offers: currency, accordion, spotlight ---------- */
function currency() {
  const SET = {
    USD: { sym: '$', budget: ['Under $1,000', '$1,000 – $2,500', '$2,500 – $5,000', '$5,000+', 'Not sure yet'] },
    INR: { sym: '₹', budget: ['Under ₹40,000', '₹40,000 – ₹1,00,000', '₹1,00,000 – ₹2,50,000', '₹2,50,000+', 'Not sure yet'] }
  };
  const apply = c => {
    CUR = c; store.set('rd-cur', c);
    $$('.cur button').forEach(b => { const on = b.dataset.cur === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-usd]').forEach(el => { $('.sym', el).textContent = SET[c].sym; $('b', el).textContent = c === 'INR' ? el.dataset.inr : el.dataset.usd; });
    $$('#budgetChips .chip').forEach((l, i) => { $('input', l).value = SET[c].budget[i]; $('span', l).textContent = SET[c].budget[i]; });
  };
  apply(CUR);
  $$('.cur button').forEach(b => b.addEventListener('click', () => apply(b.dataset.cur)));
  const small = matchMedia('(max-width:1024px)');
  $$('.plan').forEach(pl => pl.addEventListener('click', e => {
    if (!small.matches || e.target.closest('.plan__more')) return;
    const open = !pl.classList.contains('open');
    $$('.plan').forEach(o => { const on = o === pl && open; o.classList.toggle('open', on); $('.plan__tog', o).setAttribute('aria-expanded', on); });
  }));
  $$('.plan__list').forEach(ul => $$('li', ul).forEach((li, i) => li.style.setProperty('--i', i)));
  if (fine && !reduce) $$('.plan').forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
      c.style.setProperty('--rx', ((.5 - y / r.height) * 6).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x / r.width - .5) * 6).toFixed(2) + 'deg');
    });
    c.addEventListener('pointerleave', () => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); });
  });
}

/* ---------- project form: FormSubmit, preselects the offer from ?offer= ---------- */
function form() {
  const ENDPOINT = 'https://formsubmit.co/ajax/raj@rdstudio.in';
  const f = $('#projectForm'); if (!f) return;
  const err = $('#fErr'), btn = $('.form__go', f), date = $('#fDate');
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
  date.min = new Date().toLocaleDateString('en-CA');
  const sel = $('#fCode');
  CODES.split(';').forEach(s => { const w = s.split(' '), o = document.createElement('option'); o.value = '+' + w[w.length - 1]; o.dataset.iso = w[0]; o.textContent = `${w.slice(1, -1).join(' ')} (+${w[w.length - 1]})`; sel.appendChild(o); });
  const region = ((navigator.language || '').split('-')[1] || '').toUpperCase() || (/Calcutta|Kolkata/i.test(tz) ? 'IN' : '');
  const hit = [...sel.options].find(o => o.dataset.iso === region); if (hit) hit.selected = true;
  $('#tz').textContent = tz ? `Times are in your time zone (${tz}).` : '';
  const offer = new URLSearchParams(location.search).get('offer');
  if (offer) $$('input[name="Looking for"]').forEach(i => (i.checked = i.value === offer));
  const say = m => { err.textContent = m; err.hidden = !m; };
  f.addEventListener('submit', async e => {
    e.preventDefault(); say('');
    if (!$$('input[name="Looking for"]:checked', f).length) return say('Pick at least one thing you’re looking for.');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    if (fd.get('_honey')) return;
    const data = { 'Looking for': fd.getAll('Looking for').join(', '), 'Time zone': tz, 'Currency shown': CUR };
    for (const [k, v] of fd.entries()) if (k !== 'Looking for' && k !== '_honey') data[k] = v;
    data['Mobile number'] = `${fd.get('Country code')} ${fd.get('Mobile number')}`.trim(); delete data['Country code'];
    Object.assign(data, { _subject: `New project inquiry — ${fd.get('Name')}`, _template: 'table', _captcha: 'false', _replyto: fd.get('Email') });
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === 'false' || j.success === false) throw new Error('send failed');
      $('.start').classList.add('sent'); $('#fDone').hidden = false; scrollTo(0);
    } catch (_) {
      btn.disabled = false; btn.innerHTML = 'Send it <span>→</span>';
      say('Couldn’t send that. Please check your connection and try again.');
    }
  });
}

/* ---------- GSAP: heading mask reveals, offer stagger, process step, marquee, "more work" strip ---------- */
function gsapFx() {
  if (reduce) { $$('.hproc__i').forEach(i => i.classList.add('done')); return; }
  const headings = sel => $$(sel).forEach(el => {
    if (el.dataset.sl) return; el.dataset.sl = '1';
    if (/<br/i.test(el.innerHTML)) el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(t => '<span style="display:block">' + t + '</span>').join('');
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'sl-line', autoSplit: true,
      onSplit: self => gsap.from(self.lines, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
    });
  });
  const go = () => {
    headings('.sec-head h2, .offers__h, .about__h, .start__h, .terms__h, .cs__title, .more__h, .hproc__h');

    const cards = $$('.plan');
    if (cards.length) {
      gsap.set(cards, { opacity: 0, clipPath: 'inset(16% 0% 0% 0% round 24px)' });
      ScrollTrigger.batch(cards, { start: 'top 92%', once: true, onEnter: b => gsap.to(b, { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.15, ease: 'expo.out', stagger: .13, overwrite: true, clearProps: 'clipPath' }) });
    }
    const ht = $('.hproc__track');
    if (ht) {
      const items = $$('.hproc__i', ht);
      ScrollTrigger.create({ trigger: ht, start: 'top 72%', end: 'bottom 58%', scrub: true, onUpdate: self => {
        const p = self.progress; ht.style.setProperty('--rp', p.toFixed(3));
        items.forEach((it, i) => it.classList.toggle('done', p >= i / items.length + .02));
      } });
    }
    $$('.proc__i').forEach(s => ScrollTrigger.create({ trigger: s, start: 'top 58%', end: 'bottom 58%', toggleClass: { targets: s, className: 'is-now' } }));

    if (fine) {   // work videos lean slightly into the scroll
      const vz = $$('.hp__viz');
      if (vz.length) {
        const set = vz.map(v => gsap.quickTo(v, 'skewY', { duration: .7, ease: 'power3.out' })); let prev = 0;
        gsap.ticker.add(() => { const s = clamp((state.lenis ? state.lenis.velocity : 0) * .05, -1.4, 1.4); if (Math.abs(s - prev) < .01) return; prev = s; set.forEach(f => f(s)); });
      }
    }
    const track = $('.marquee__track');   // tools marquee: speeds up with scroll, follows scroll direction
    if (track) {
      track.innerHTML += track.innerHTML; track.style.animation = 'none';
      const tw = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 }); let dir = 1, hover = false;
      const m = $('.marquee'); m.addEventListener('mouseenter', () => (hover = true)); m.addEventListener('mouseleave', () => (hover = false));
      gsap.ticker.add(() => { const v = state.lenis ? state.lenis.velocity : 0; if (Math.abs(v) > .25) dir = v > 0 ? 1 : -1; tw.timeScale(lerp(tw.timeScale(), hover ? 0 : dir * (1 + Math.min(7, Math.abs(v) * .45)), .08)); });
    }
    ScrollTrigger.refresh();
  };
  whenReady(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go));
  addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------- init ---------- */
splitLetters(); splitWords();
smoothScroll(); boot(); transitions(); cursor(); hero(); scrollFx(); reveals(); magnetic(); nav(); spec(); fitContact(); fitHero(); menu(); currency(); form();
initPlayer(); initPreviews(); gsapFx();
requestAnimationFrame(() => state.lenis && state.lenis.resize()); addEventListener('load', () => state.lenis && state.lenis.resize());
if ($('.contact__h')) import('./physics.js').then(m => m.footerPhysics()).catch(err => console.warn('[RD] footer physics unavailable', err));
