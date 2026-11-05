/* RD Studio — enhancement layer
   Runs AFTER the page script in index.html. Every block guards for its own library / device, so if one fails the site still works.
   1 smooth scroll (Lenis)   2 GSAP (ScrollTrigger, SplitText)   3 WebGL background (raw GLSL)
   4 footer physics (Matter.js)   5 hero 3D orb (Three.js, lazy)
   Design rule: black / white / red only. Desktop gets the heavy stuff; phones keep the calm static layout. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const body = document.body, root = document.documentElement;
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || location.href;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  let lenis = null;

  const whenLoaded = cb => {
    if (!body.classList.contains('is-loading')) return cb();
    const mo = new MutationObserver(() => { if (!body.classList.contains('is-loading')) { mo.disconnect(); cb(); } });
    mo.observe(body, { attributes: true, attributeFilter: ['class'] });
  };

  /* =========================================================
     1. SMOOTH SCROLL — Lenis, driven by GSAP's ticker so ScrollTrigger stays in sync
     ========================================================= */
  function smoothScroll() {
    if (reduce || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: .1, wheelMultiplier: .95, smoothWheel: true, autoRaf: false, anchors: false });
    window.__lenis = lenis;

    if (hasGSAP) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = t => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    // no scrolling while the loader, mobile menu or video player is up
    const sync = () => {
      const lock = body.classList.contains('is-loading') || body.classList.contains('menu-open') || body.classList.contains('player-open');
      lock ? lenis.stop() : lenis.start();
    };
    new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] });
    sync();

    // inputs that scroll on their own
    $$('textarea,select').forEach(el => el.setAttribute('data-lenis-prevent', ''));
    const pl = $('#player'); if (pl) pl.setAttribute('data-lenis-prevent', '');

    // in-page anchors on the home view (#work, #contact, #top ...). Route links (#/about, #/start, #/terms) stay with the router.
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const h = a.getAttribute('href');
      if (h === '#' || h.startsWith('#/') || body.dataset.view !== 'home') return;
      const target = h === '#top' ? 0 : $(h);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4), force: true });
    });
  }

  /* =========================================================
     2. GSAP — heading mask reveals, plan-card stagger, marquee that follows scroll velocity,
        scroll-velocity skew on the work videos, active process step
     ========================================================= */
  function gsapFx() {
    if (reduce || !hasGSAP) return;
    const hasSplit = typeof SplitText !== 'undefined';
    gsap.registerPlugin(ScrollTrigger); if (hasSplit) gsap.registerPlugin(SplitText);
    const done = new Set();

    // headings: each line slides up out of a mask. Split lazily (a hidden view can't be measured), re-splits on resize / font load.
    const headings = sel => {
      if (!hasSplit) return;
      $$(sel).forEach(el => {
        if (!el.offsetParent || el.dataset.sl) return;
        el.dataset.sl = '1';
        // <br> becomes a block per line so SplitText measures clean lines
        if (/<br/i.test(el.innerHTML)) el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map(t => '<span style="display:block">' + t + '</span>').join('');
        SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'sl-line', autoSplit: true,
          onSplit: self => gsap.from(self.lines, {
            yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: .09,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          })
        });
      });
    };

    const plans = () => {
      const cards = $$('.plan'); if (!cards.length) return;
      gsap.set(cards, { opacity: 0, clipPath: 'inset(16% 0% 0% 0% round 24px)' });
      ScrollTrigger.batch(cards, {
        start: 'top 92%', once: true,
        onEnter: b => gsap.to(b, { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.15, ease: 'expo.out', stagger: .13, overwrite: true, clearProps: 'clipPath' })
      });
    };

    // work videos lean slightly into the scroll
    const skew = () => {
      if (!fine) return;
      const vz = $$('.viz'); if (!vz.length) return;
      const set = vz.map(v => gsap.quickTo(v, 'skewY', { duration: .7, ease: 'power3.out' }));
      let prevSkew = 0;
      gsap.ticker.add(() => {
        if (body.dataset.view !== 'home') return;
        const v = lenis ? lenis.velocity : 0;
        const s = clamp(v * .05, -1.4, 1.4);
        if (Math.abs(s - prevSkew) < .01) return;
        prevSkew = s; set.forEach(f => f(s));
      });
    };

    // tools marquee: runs on a GSAP tween, speeds up with scroll and flips with scroll direction
    const marquee = () => {
      const wrap = $('.marquee'), track = $('.marquee__track'); if (!track) return;
      track.style.animation = 'none';
      const tw = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
      let dir = 1, hover = false;
      if (wrap) { wrap.addEventListener('mouseenter', () => (hover = true)); wrap.addEventListener('mouseleave', () => (hover = false)); }
      gsap.ticker.add(() => {
        if (body.dataset.view !== 'about') return;
        const v = lenis ? lenis.velocity : 0;
        if (Math.abs(v) > .25) dir = v > 0 ? 1 : -1;
        const target = hover ? 0 : dir * (1 + Math.min(7, Math.abs(v) * .45));
        tw.timeScale(lerp(tw.timeScale(), target, .08));
      });
    };

    // process: the step in the middle of the screen lights up red
    const steps = () => $$('.step').forEach(s => ScrollTrigger.create({
      trigger: s, start: 'top 58%', end: 'bottom 58%', toggleClass: { targets: s, className: 'cur' }
    }));

    const init = v => {
      if (done.has(v)) return; done.add(v);
      if (v === 'home') { headings('.sec-head h2, .offers__h'); plans(); skew(); }
      if (v === 'about') { headings('.about__h'); marquee(); steps(); }
      if (v === 'start') headings('.start__h');
      if (v === 'terms') headings('.terms__h');
    };

    const refresh = () => { ScrollTrigger.refresh(); if (lenis) lenis.resize(); };
    whenLoaded(() => {
      const go = () => {
        init(body.dataset.view || 'home'); refresh();
        new MutationObserver(() => requestAnimationFrame(() => { init(body.dataset.view || 'home'); refresh(); }))
          .observe(body, { attributes: true, attributeFilter: ['data-view'] });
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
      addEventListener('load', () => ScrollTrigger.refresh());
    });
  }

  /* =========================================================
     3. WEBGL BACKGROUND — one fragment shader replaces the CSS glows.
        Domain-warped noise, black base, red + white glow, reacts to cursor and scroll. Falls back to the CSS glows on any failure.
     ========================================================= */
  function shaderBg() {
    if (reduce) return;
    const cv = document.createElement('canvas'); cv.id = 'bgGL'; cv.setAttribute('aria-hidden', 'true');
    let gl;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (_) { gl = null; }
    if (!gl) return;
    const small = innerWidth <= 820 || !fine;

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define OCT ${small ? 3 : 4}
uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uS; uniform float uV;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<OCT;i++){ s+=a*noise(p); p=m*p; a*=.5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; float asp = uRes.x/uRes.y;
  vec2 p = (uv-.5)*vec2(asp,1.)*1.15;
  vec2 m = (uM-.5)*vec2(asp,1.)*1.15;
  float t = uT*.055;
  vec2 q = p; q.y += uS*2.6;
  vec2 w = vec2(fbm(q*1.2+vec2(0.,t)), fbm(q*1.2+vec2(5.2,1.3)-t));
  vec2 r = vec2(fbm(q*1.1+2.4*w+vec2(1.7,9.2)+t*1.4), fbm(q*1.1+2.4*w+vec2(8.3,2.8)-t));
  float f = fbm(q*.9+2.6*r);
  float md = length(p-m); float mg = exp(-md*md*5.);
  f += mg*.14;
  float redA = smoothstep(.40,.88,f);
  float whiteA = smoothstep(.60,1.,fbm(q*.7+2.*r+7.1));
  vec3 col = vec3(1.,.10,.15)*redA*.32;
  col += vec3(1.)*whiteA*(.10+uV*.06);
  col += vec3(1.,.10,.14)*mg*.12;
  float vg = 1.-smoothstep(.2,1.3,length(uv-.5)*1.7);
  col *= .5+.5*vg;
  col += (hash(gl_FragCoord.xy+fract(uT))-.5)/255.;
  gl_FragColor = vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn('[RD] shader', gl.getShaderInfoLog(s)), null); };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return;
    const pg = gl.createProgram(); gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.linkProgram(pg);
    if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) return;
    gl.useProgram(pg);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one big triangle
    const loc = gl.getAttribLocation(pg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pg, n), uRes = U('uRes'), uT = U('uT'), uM = U('uM'), uS = U('uS'), uV = U('uV');

    body.insertBefore(cv, body.firstChild); root.classList.add('gl-bg');
    let scale = small ? .35 : .5;
    const size = () => {
      cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale));
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
    };
    size(); addEventListener('resize', size);

    let mx = .7, my = .4, cx = mx, cy = my, vel = 0, t = 0, prev = performance.now(), raf = 0, paused = false, slow = 0, frames = 0, drops = 0;
    addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = 1 - e.clientY / innerHeight; }, { passive: true });
    const off = () => { cancelAnimationFrame(raf); cv.remove(); root.classList.remove('gl-bg'); };    // back to the CSS glows
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); off(); });

    const frame = now => {
      raf = 0; if (paused) return;
      const dt = Math.min(.06, (now - prev) / 1000); prev = now;
      // adaptive quality: if the GPU struggles, render smaller; if it still struggles, hand back to the CSS glows
      if (dt > .034) slow++; frames++;
      if (frames === 40) { if (slow > 24) { if (++drops > 2) return off(); scale *= .72; size(); } frames = 0; slow = 0; }
      cx = lerp(cx, mx, .05); cy = lerp(cy, my, .05);
      const sp = clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight));
      const v = lenis ? Math.abs(lenis.velocity) : 0; vel = lerp(vel, Math.min(1, v * .04), .08);
      t += dt * (1 + vel * 3);
      gl.uniform1f(uT, t); gl.uniform2f(uM, cx, cy); gl.uniform1f(uS, sp); gl.uniform1f(uV, vel);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !paused) { prev = performance.now(); raf = requestAnimationFrame(frame); } };
    const upd = () => { paused = document.hidden || body.classList.contains('player-open'); paused ? (cancelAnimationFrame(raf), raf = 0) : kick(); };
    document.addEventListener('visibilitychange', upd);
    new MutationObserver(upd).observe(body, { attributes: true, attributeFilter: ['class'] });
    kick();
  }

  /* =========================================================
     4. FOOTER PHYSICS — "LET'S MOVE IT": each letter is a rigid body (Matter.js).
        Letters drop into place when the headline scrolls in, then can be grabbed, thrown and shoved.
        They rest on the headline's own baseline, so the line stays readable until someone plays with it.
        Double-click the headline (or scroll away and back) to reset.
     ========================================================= */
  function footerPhysics() {
    if (reduce || !fine || typeof Matter === 'undefined') return;
    const { Engine, Bodies, Body, Composite, Constraint, Query, Sleeping } = Matter;
    const sec = $('.contact'), h = $('.contact__h'); if (!sec || !h) return;

    let engine = null, items = [], timers = [], raf = 0, inView = false, dropped = false, drag = null, acc = 0, last = 0, on = false;

    const teardown = () => {
      cancelAnimationFrame(raf); raf = 0; timers.forEach(clearTimeout); timers = [];
      if (engine) { Composite.clear(engine.world, false); Engine.clear(engine); }
      items.forEach(it => { it.el.style.translate = ''; it.el.style.rotate = ''; it.el.style.opacity = ''; });
      engine = null; items = []; drag = null; dropped = false; sec.classList.remove('phys-on');
    };

    const build = () => {
      teardown();
      if (innerWidth <= 820 || !sec.offsetParent) { h.classList.remove('phys'); on = false; return; }
      h.classList.add('phys'); on = true;
      const chars = $$('.ch', h).filter(c => c.textContent.trim());
      chars.forEach(c => { c.style.translate = ''; c.style.rotate = ''; c.style.opacity = '0'; });
      const sr = sec.getBoundingClientRect(), W = sr.width;
      engine = Engine.create({ enableSleeping: true }); engine.gravity.y = 2;
      let floor = 0;
      items = chars.map(el => {
        const r = el.getBoundingClientRect();
        const home = { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2, w: r.width, h: r.height };
        floor = Math.max(floor, home.y + home.h / 2);
        return { el, home, body: null, drawn: false };
      });
      const wall = (x, y, w, hh) => Bodies.rectangle(x, y, w, hh, { isStatic: true, friction: .6 });
      Composite.add(engine.world, [
        wall(W / 2, floor + 200, W + 800, 400),            // floor = the headline's baseline
        wall(-200, floor - 2500, 400, 6000),               // left / right walls
        wall(W + 200, floor - 2500, 400, 6000)
      ]);
      items.forEach(it => {
        it.body = Bodies.rectangle(it.home.x, it.home.y, it.home.w * .88, it.home.h * .94, {
          chamfer: { radius: Math.min(it.home.w, it.home.h) * .07 },
          restitution: .2, friction: .6, frictionStatic: 1, frictionAir: .012, density: .002, sleepThreshold: 45, slop: .04,
          collisionFilter: { group: -1 }                       // letters ignore each other while they drop, so each lands in its own slot
        });
        Body.setInertia(it.body, it.body.inertia * 3);         // harder to topple; still tumbles when thrown
      });
    };

    const solid = () => { items.forEach(it => { if (it.body) it.body.collisionFilter.group = 0; }); };   // letters now collide with each other

    const drop = () => {
      if (!engine || dropped) return; dropped = true;
      const rise = Math.min(420, Math.max(260, innerHeight * .5));
      items.forEach((it, i) => {
        timers.push(setTimeout(() => {
          if (!engine) return;
          const b = it.body;
          Body.setPosition(b, { x: it.home.x, y: Math.max(it.home.h, it.home.y - rise - i * 28) });
          Body.setAngle(b, 0); Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0);
          Composite.add(engine.world, b); it.el.style.opacity = '1';
        }, 120 + i * 75));
      });
      timers.push(setTimeout(solid, 120 + items.length * 75 + 2200));
      timers.push(setTimeout(() => sec.classList.add('phys-on'), 120 + items.length * 75 + 2300));
      run();
    };

    const draw = () => {
      for (const it of items) {
        const b = it.body; if (!b || !b.parent) continue;
        if (b.isSleeping && it.drawn) continue;
        it.el.style.translate = `${(b.position.x - it.home.x).toFixed(1)}px ${(b.position.y - it.home.y).toFixed(1)}px`;
        it.el.style.rotate = `${b.angle.toFixed(4)}rad`;
        it.drawn = b.isSleeping;
      }
    };

    const step = now => {
      raf = 0; if (!engine || !inView) return;
      acc += Math.min(50, now - last); last = now;
      for (let n = 0; acc >= 16.667 && n < 3; n++) { Engine.update(engine, 16.667); acc -= 16.667; }
      if (acc > 50) acc = 0;
      draw(); raf = requestAnimationFrame(step);
    };
    function run() { if (!raf && engine && inView) { last = performance.now(); acc = 0; raf = requestAnimationFrame(step); } }

    // visibility: start the drop when the headline is mostly on screen, reset when it has fully left
    new IntersectionObserver(([e]) => {
      if (!on) return;
      if (e.intersectionRatio >= .55 && !dropped) drop();
      else if (e.intersectionRatio === 0 && dropped) { const wasIn = inView; teardown(); build(); inView = wasIn; }
    }, { threshold: [0, .55] }).observe(h);
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? run() : (cancelAnimationFrame(raf), raf = 0); }).observe(sec);

    // pointer: grab + throw
    const local = e => { const r = sec.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let px = 0, py = 0, pv = 0;
    sec.addEventListener('pointerenter', e => { px = e.clientX; py = e.clientY; });
    sec.addEventListener('pointerdown', e => {
      if (!engine || e.button !== 0) return;
      const p = local(e), hit = Query.point(items.filter(i => i.body.parent).map(i => i.body), p)[0];
      if (!hit) return;
      e.preventDefault(); solid();
      const con = Constraint.create({ pointA: p, bodyB: hit, pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y }, stiffness: .16, damping: .12, length: 0 });
      Composite.add(engine.world, con); Sleeping.set(hit, false);
      drag = { con, id: e.pointerId }; sec.setPointerCapture(e.pointerId); sec.classList.add('phys-drag');
    });
    sec.addEventListener('pointermove', e => {
      if (!engine) return;
      const p = local(e); pv = Math.hypot(e.clientX - px, e.clientY - py); const vx = e.clientX - px, vy = e.clientY - py; px = e.clientX; py = e.clientY;
      if (drag) { drag.con.pointA = p; return; }
      if (pv < 7 || !dropped) return;
      solid();                                      // only a quick sweep shoves letters; slow hovering leaves them alone
      for (const it of items) {
        const b = it.body; if (!b.parent) continue;
        const dx = b.position.x - p.x, dy = b.position.y - p.y, d = Math.hypot(dx, dy), R = Math.max(110, it.home.h * .9);
        if (d < R) {
          const f = 1 - d / R; Sleeping.set(b, false);
          Body.setVelocity(b, { x: b.velocity.x + vx * .07 * f, y: b.velocity.y + vy * .05 * f - 1.2 * f });
          Body.setAngularVelocity(b, b.angularVelocity + vx * .0009 * f);
        }
      }
    });
    const release = () => { if (!drag || !engine) return; Composite.remove(engine.world, drag.con); try { sec.releasePointerCapture(drag.id); } catch (_) {} drag = null; sec.classList.remove('phys-drag'); };
    sec.addEventListener('pointerup', release); sec.addEventListener('pointercancel', release);
    h.addEventListener('dblclick', () => { if (!engine) return; const wasIn = inView; teardown(); build(); inView = wasIn; drop(); });

    // (re)build once fonts are in and the headline has been fitted; again on resize and when the home view comes back
    let rt = 0;
    const rebuild = () => { clearTimeout(rt); rt = setTimeout(() => { const wasIn = inView; build(); inView = wasIn; if (on && wasIn) { const r = h.getBoundingClientRect(); if (r.top < innerHeight * .45 && r.bottom > 0) drop(); } }, 320); };
    addEventListener('resize', rebuild);
    new MutationObserver(rebuild).observe(body, { attributes: true, attributeFilter: ['data-view'] });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => whenLoaded(rebuild));
  }

  /* =========================================================
     5. HERO 3D — Three.js orb, lazy-loaded after the loader. Desktop only.
     ========================================================= */
  function hero3d() {
    if (!fine || innerWidth <= 820) return;
    const hero = $('.hero'); if (!hero) return;
    try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return; } catch (_) { return; }
    const go = () => import(new URL('hero3d.js', SCRIPT_URL).href)
      .then(m => m.mountHero(hero, { reduce }))
      .catch(err => console.warn('[RD] hero 3D unavailable:', err));
    whenLoaded(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 400)));
  }

  /* ---------- init: each block is isolated so one failure never takes the others down ---------- */
  [smoothScroll, gsapFx, shaderBg, footerPhysics, hero3d].forEach(fn => { try { fn(); } catch (err) { console.warn('[RD] ' + fn.name + ' failed:', err); } });
})();
