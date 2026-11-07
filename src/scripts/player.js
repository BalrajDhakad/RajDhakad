// Custom full-screen player (YouTube's own controls are switched off) + muted looping previews on the work cards.
import { $, $$, reduce, state, loadYT } from './util.js';

const vars = o => Object.assign({ controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, cc_load_policy: 0, playsinline: 1, origin: location.origin }, o);
const noCC = p => { const off = () => { try { p.unloadModule('captions'); p.unloadModule('cc'); } catch (_) {} }; off(); setTimeout(off, 600); setTimeout(off, 2000); };
const mk = (id, o) => {
  const f = document.createElement('iframe');
  f.src = 'https://www.youtube.com/embed/' + id + '?' + new URLSearchParams(Object.assign({ enablejsapi: 1 }, vars(o)));
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.title = 'Video'; f.tabIndex = -1;
  return f;
};
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const previews = [];

export function initPlayer() {
  const P = $('#player'); if (!P) return;
  const seek = $('#pSeek'), playBtn = $('#pPlay'), muteBtn = $('#pMute'), timeEl = $('#pTime'), fs = $('#pFs');
  let main = null, tick = 0, idleT = 0, last = null, lastId = '', drag = false, mainState = -1, errT = 0;

  const toggle = () => main && main.getPlayerState && (main.getPlayerState() === 1 ? main.pauseVideo() : main.playVideo());
  const ui = () => {
    if (!main || !main.getDuration) return;
    const d = main.getDuration() || 0, t = main.getCurrentTime() || 0;
    timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
    muteBtn.textContent = main.isMuted() ? 'Sound off' : 'Sound on';
    if (drag) return;
    const v = d ? (t / d) * 1000 : 0;
    seek.value = v; seek.style.setProperty('--v', (v / 10) + '%');
  };
  const showErr = on => { const a = $('#pFallback'); a.hidden = !on; $('#pErr').hidden = !on; if (on) a.href = 'https://youtu.be/' + lastId; };
  const wake = () => { P.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => P.classList.add('idle'), 2500); };

  function open(id, title, opener) {
    if (!/^https?:$/.test(location.protocol)) return window.open('https://youtu.be/' + id, '_blank');   // YouTube refuses embeds on file://
    last = opener; lastId = id; state.playerOpen = true; dispatchEvent(new Event('rd:player'));
    $('#pTitle').textContent = title || ''; showErr(false); mainState = -1; clearTimeout(errT);
    errT = setTimeout(() => { if (mainState !== 1 && mainState !== 3) showErr(true); }, 8000);   // never stuck on a dead player
    P.classList.add('open'); document.body.classList.add('player-open'); wake(); $('#pClose').focus();
    loadYT(() => {
      if (!state.playerOpen) return;
      if (!main) {
        const f = mk(id, { autoplay: 1 }); $('#ytMain').appendChild(f);
        main = new YT.Player(f, { events: {
          onError: () => showErr(true), onApiChange: e => noCC(e.target),
          onReady: e => { noCC(e.target); e.target.unMute(); e.target.setVolume(100); e.target.playVideo(); },
          onStateChange: e => { mainState = e.data; playBtn.textContent = e.data === 1 ? 'Pause' : 'Play'; if (e.data === 1) { clearTimeout(errT); showErr(false); noCC(e.target); } }
        } });
      } else { main.loadVideoById(id); main.unMute(); }
      clearInterval(tick); tick = setInterval(ui, 250);
    });
  }
  function close() {
    if (!state.playerOpen) return;
    state.playerOpen = false; dispatchEvent(new Event('rd:player')); clearInterval(tick); clearTimeout(errT);
    if (document.fullscreenElement) document.exitFullscreen();
    if (main && main.pauseVideo) main.pauseVideo();
    P.classList.remove('open'); document.body.classList.remove('player-open');
    if (last && last.focus) last.focus();
  }

  $('#pClose').onclick = close;
  $('#pPlay').onclick = $('#pHit').onclick = toggle;
  muteBtn.onclick = () => main && (main.isMuted() ? main.unMute() : main.mute());
  if (!P.requestFullscreen) fs.hidden = true;
  fs.onclick = () => document.fullscreenElement ? document.exitFullscreen() : P.requestFullscreen();
  seek.oninput = () => main && main.seekTo(seek.value / 1000 * main.getDuration(), true);
  seek.addEventListener('pointerdown', () => (drag = true));
  addEventListener('pointerup', () => (drag = false));
  P.addEventListener('pointermove', wake);
  addEventListener('keydown', e => {
    if (!state.playerOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && e.target !== seek && main) main.seekTo(main.getCurrentTime() + 5, true);
    else if (e.key === 'ArrowLeft' && e.target !== seek && main) main.seekTo(main.getCurrentTime() - 5, true);
    wake();
  });

  // anything with data-play opens the player (hero reel, case-study poster, "more work" cards)
  const trigger = el => open(el.dataset.play, el.dataset.title, el);
  document.addEventListener('click', e => { const t = e.target.closest('[data-play]'); if (!t) return; e.preventDefault(); trigger(t); });
  document.addEventListener('keydown', e => {
    if (state.playerOpen || (e.key !== 'Enter' && e.key !== ' ')) return;
    const t = e.target.closest && e.target.closest('[data-play][role="button"]'); if (!t) return;
    e.preventDefault(); trigger(t);
  });
}

// muted 14-second looping previews inside the hero-project cards; they only play while on screen and while the player is closed
export function initPreviews() {
  const cards = $$('.hp__in[data-yt]'); if (!cards.length) return;
  if (!/^https?:$/.test(location.protocol)) { cards.forEach(el => $('.yt', el).classList.add('fail')); return; }
  const sync = c => { if (!c.ready) return; (c.vis && !state.playerOpen && !reduce) ? c.p.playVideo() : c.p.pauseVideo(); };
  const io = new IntersectionObserver(es => es.forEach(e => { const c = previews.find(x => x.el === e.target); if (c) { c.vis = e.isIntersecting; sync(c); } }), { threshold: .25 });
  addEventListener('rd:player', () => previews.forEach(sync));
  const build = () => cards.forEach(el => {
    const id = el.dataset.yt, start = +el.dataset.start || 0, box = $('.yt', el), f = mk(id, { mute: 1, start, end: start + 14 });
    box.appendChild(f);
    const c = { el, vis: false, ready: false };
    c.p = new YT.Player(f, { events: {
      onError: () => box.classList.add('fail'),
      onApiChange: () => noCC(c.p),
      onReady: () => { c.ready = true; c.p.mute(); noCC(c.p); sync(c); },
      onStateChange: e => { if (e.data === 1) { box.classList.add('live'); noCC(c.p); } if (e.data === 0) { c.p.seekTo(start); c.p.playVideo(); } }
    } });
    previews.push(c); io.observe(el);
  });
  // start loading only when the work section is about to be seen (keeps the first paint light)
  const w = $('#work');
  if (!w) return;
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); loadYT(build); } }, { rootMargin: '600px 0px' }).observe(w);
}
