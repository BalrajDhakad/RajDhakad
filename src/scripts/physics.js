// Footer physics: "LET'S MOVE IT". Each letter is a rigid body (Matter.js).
// Letters drop into their own slots (ignoring each other while falling, so the headline stays readable),
// then become solid: grab, throw or shove them. Double-click the headline or scroll away and back to reset.
import Matter from 'matter-js';
import { $, $$, reduce, fine, whenReady } from './util.js';

export function footerPhysics() {
  if (reduce || !fine) return;
  const { Engine, Bodies, Body, Composite, Constraint, Query, Sleeping } = Matter;
  const sec = $('.contact'), h = $('.contact__h'); if (!sec || !h) return;
  const body = document.body;

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
    Composite.add(engine.world, [wall(W / 2, floor + 200, W + 800, 400), wall(-200, floor - 2500, 400, 6000), wall(W + 200, floor - 2500, 400, 6000)]);
    items.forEach(it => {
      it.body = Bodies.rectangle(it.home.x, it.home.y, it.home.w * .88, it.home.h * .94, {
        chamfer: { radius: Math.min(it.home.w, it.home.h) * .07 },
        restitution: .2, friction: .6, frictionStatic: 1, frictionAir: .012, density: .002, sleepThreshold: 45, slop: .04,
        collisionFilter: { group: -1 }
      });
      Body.setInertia(it.body, it.body.inertia * 3);
    });
  };

  const solid = () => { items.forEach(it => { if (it.body) it.body.collisionFilter.group = 0; }); };

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

  const reset = () => { const wasIn = inView; teardown(); build(); inView = wasIn; };

  // drop when the headline is mostly on screen
  new IntersectionObserver(([e]) => { if (on && e.intersectionRatio >= .55 && !dropped) drop(); }, { threshold: [.55] }).observe(h);
  // reset only once the whole footer is well out of sight (about a third of a screen past its edge), so nobody sees it reset
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting; inView ? run() : (cancelAnimationFrame(raf), raf = 0);
    if (!e.isIntersecting && dropped) reset();
  }, { rootMargin: '35% 0px 35% 0px' }).observe(sec);

  const local = e => { const r = sec.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let px = 0, py = 0;
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
    const p = local(e), vx = e.clientX - px, vy = e.clientY - py, pv = Math.hypot(vx, vy); px = e.clientX; py = e.clientY;
    if (drag) { drag.con.pointA = p; return; }
    if (pv < 7 || !dropped) return;
    solid();
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
  h.addEventListener('dblclick', () => { if (!engine) return; reset(); drop(); });

  let rt = 0;
  const rebuild = () => { clearTimeout(rt); rt = setTimeout(() => { const wasIn = inView; build(); inView = wasIn; if (on && wasIn) { const r = h.getBoundingClientRect(); if (r.top < innerHeight * .45 && r.bottom > 0) drop(); } }, 320); };
  addEventListener('resize', rebuild);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => whenReady(rebuild));
}
