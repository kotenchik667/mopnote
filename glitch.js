(() => {
  'use strict';
  const canvas = document.getElementById('glitchCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) { canvas.hidden = true; return; }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0.5, y: 0.5 };
  let width = 1, height = 1, ratio = 1, frameId = 0, timer = 0, active = false;
  let lastTime = 0, flash = 0, particles = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const mobile = () => window.innerWidth < 700;
  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    ratio = Math.min(mobile() ? 1 : 1.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: mobile() ? 48 : 145 }, (_, i) => ({
      x: rand(0, width), y: rand(0, height), amplitude: rand(3, 24),
      phase: rand(0, Math.PI * 2), speed: rand(0.00013, 0.00049),
      size: rand(0.7, 2.3), seed: i
    }));
  }
  function render(t) {
    const dt = Math.min(70, Math.max(0, t - lastTime));
    lastTime = t;
    flash = Math.max(0, flash - dt * .0027);
    const dark = document.documentElement.dataset.theme === 'dark';
    const ink = dark ? '239,231,219' : '37,37,33';
    const signal = dark ? '240,108,74' : '221,67,45';
    const pulse = .5 + .5 * Math.sin(t * .0009);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (dark ? .10 : .09) + ')';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 44) {
      ctx.moveTo(x + .5, 0);
      ctx.lineTo(x + .5, height);
    }
    for (let y = 0; y <= height; y += 44) {
      ctx.moveTo(0, y + .5);
      ctx.lineTo(width, y + .5);
    }
    ctx.stroke();
    for (let wave = 0; wave < (mobile() ? 3 : 5); wave++) {
      ctx.beginPath();
      const baseline = height * (.14 + wave * .17);
      for (let x = 0; x <= width; x += 9) {
        const bend = Math.sin(x * .017 + t * .0014 + wave * 2.2) * (15 + wave * 6);
        const harmonic = Math.sin(x * .036 - t * .0008 + wave * 1.6) * 8;
        const pointerField = 11 * Math.exp(-Math.abs(x / width - pointer.x) * 9);
        const y = baseline + bend + harmonic + pointerField * Math.sin(t * .003);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(' + (wave % 2 ? ink : signal) + ',' + (dark ? .14 : .12) + ')';
      ctx.stroke();
    }
    for (const p of particles) {
      const x = (p.x + Math.sin(t * p.speed + p.phase) * p.amplitude + width) % width;
      const y = (p.y + Math.cos(t * p.speed * .72 + p.phase) * p.amplitude + height) % height;
      const drift = Math.sin(t * .0005 + p.seed);
      ctx.fillStyle = 'rgba(' + (p.seed % 4 ? ink : signal) + ',' + (.13 + .15 * Math.abs(drift)) + ')';
      ctx.fillRect(x, y, p.size * (1 + Math.abs(drift) * 4), p.size);
    }
    const bandY = (t * .07) % height;
    ctx.fillStyle = 'rgba(' + signal + ',.19)';
    ctx.fillRect(0, bandY, width, 1.5);
    ctx.fillStyle = 'rgba(' + signal + ',.055)';
    ctx.fillRect(0, bandY - 12, width, 12);
    for (let i = 0; i < (mobile() ? 18 : 52); i++) {
      const xx = rand(0, width), yy = rand(0, height);
      const alpha = rand(.12, .30) * (i % 4 === 0 ? 1 : .7);
      ctx.fillStyle = 'rgba(' + (i % 3 ? ink : signal) + ',' + alpha + ')';
      ctx.fillRect(xx, yy, rand(9, mobile() ? 90 : 260), rand(.5, 3.4));
      if (i % 6 === 0) ctx.fillRect(xx + rand(5, 18), yy + 7, rand(6, 35), 2);
    }
    const xsplit = (Math.sin(t * .00029) * .5 + .5) * width;
    const ysplit = (Math.cos(t * .00021) * .5 + .5) * height;
    ctx.strokeStyle = 'rgba(' + signal + ',' + (.18 + pulse * .14) + ')';
    ctx.beginPath();
    ctx.moveTo(xsplit - 14, ysplit);ctx.lineTo(xsplit + 14, ysplit);
    ctx.moveTo(xsplit, ysplit - 14);ctx.lineTo(xsplit, ysplit + 14);
    ctx.stroke();
    if (flash) {
      ctx.fillStyle = 'rgba(' + signal + ',' + Math.min(.12, flash * .09) + ')';
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(' + ink + ',' + rand(.08, .3) + ')';
        ctx.fillRect(rand(0, width), rand(0, height), rand(30, width / 3), rand(1, 5));
      }
    }
  }
  function stop() {
    active = false;
    if (frameId) cancelAnimationFrame(frameId);
    if (timer) clearTimeout(timer);
    frameId = 0;
    timer = 0;
  }
  function draw(t) {
    frameId = 0;
    if (!active) return;
    render(t);
    timer = window.setTimeout(() => {
      timer = 0;
      if (active) frameId = requestAnimationFrame(draw);
    }, mobile() ? 75 : 36);
  }
  function sync() {
    const allow = !reduced.matches && !document.hidden;
    canvas.hidden = reduced.matches;
    if (!allow) { stop(); return; }
    if (!active) {
      resize();
      active = true;
      lastTime = 0;
      frameId = requestAnimationFrame(draw);
    }
  }
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => { if (active) resize(); }, { passive: true });
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX / Math.max(1, width);
    pointer.y = e.clientY / Math.max(1, height);
  }, { passive: true });
  document.addEventListener('mopnote:quote-updated', () => { flash = 1; });
  if (reduced.addEventListener) reduced.addEventListener('change', sync);
  else if (reduced.addListener) reduced.addListener(sync);
  sync();
})();
