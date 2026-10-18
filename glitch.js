(() => {
  'use strict';
  const canvas = document.getElementById('glitchCanvas');
  const button = document.getElementById('glitchToggle');
  const label = document.getElementById('glitchLabel');
  if (!canvas || !button || !label) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) {
    canvas.hidden = true;
    button.disabled = true;
    button.setAttribute('aria-label', 'Background animation unavailable');
    return;
  }
  const key = 'mopnote:glitch:v1';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== 'off'; } catch (_) {}
  let active = false;
  let width = 1;
  let height = 1;
  let handle = 0;
  let timeout = 0;
  const mobile = () => window.innerWidth < 650;
  const random = (low, high) => low + Math.random() * (high - low);
  function resize() {
    const ratio = Math.min(mobile() ? 1 : 1.4, window.devicePixelRatio || 1);
    width = Math.min(window.innerWidth, 1600);
    height = Math.min(window.innerHeight, 1000);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  }
  function paint(now) {
    ctx.clearRect(0, 0, width, height);
    const dark = document.documentElement.dataset.theme === 'dark';
    const ink = dark ? '235,234,224' : '27,27,25';
    const red = dark ? '240,108,74' : '220,67,45';
    const faint = dark ? .055 : .045;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(' + ink + ',' + faint + ')';
    ctx.beginPath();
    for (let x = 0; x < width; x += 72) {
      ctx.moveTo(x + .5, 0);
      ctx.lineTo(x + .5, height);
    }
    for (let y = 0; y < height; y += 58) {
      ctx.moveTo(0, y + .5);
      ctx.lineTo(width, y + .5);
    }
    ctx.stroke();
    const scanY = (now * .031) % Math.max(1, height);
    ctx.fillStyle = 'rgba(' + red + ',.13)';
    ctx.fillRect(0, scanY, width, 1.5);
    ctx.fillStyle = 'rgba(' + red + ',.03)';
    ctx.fillRect(0, scanY - 11, width, 11);
    const numberOfBars = mobile() ? 10 : 22;
    for (let i = 0; i < numberOfBars; i++) {
      const x = Math.floor(random(0, width));
      const y = Math.floor(random(0, height));
      const length = random(12, mobile() ? 125 : 255);
      const thickness = random(.6, 3);
      const shade = Math.random() < .43 ? red : ink;
      const alpha = random(dark ? .06 : .08, dark ? .24 : .23);
      ctx.fillStyle = 'rgba(' + shade + ',' + alpha + ')';
      ctx.fillRect(x, y, Math.min(length, width - x), thickness);
      if (i % 4 === 0) {
        ctx.fillStyle = 'rgba(' + red + ',.13)';
        ctx.fillRect(x + random(1, 8), y + 5, random(8, 33), 2);
      }
    }
    const clusters = mobile() ? 3 : 7;
    for (let cluster = 0; cluster < clusters; cluster++) {
      const x = random(0, width);
      const y = random(0, height);
      const blocks = Math.floor(random(3, 8));
      for (let i = 0; i < blocks; i++) {
        ctx.fillStyle = 'rgba(' + (i % 3 ? ink : red) + ',' + random(.05, .19) + ')';
        ctx.fillRect(x + random(-21, 27), y + i * random(3, 7), random(3, 19), random(1, 4));
      }
    }
    const anchors = mobile() ? 2 : 4;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    for (let i = 0; i < anchors; i++) {
      const x = (i * 331 + 28) % width;
      const y = (i * 183 + Math.floor(now * .005) * 17 + 91) % height;
      ctx.fillStyle = 'rgba(' + ink + ',.16)';
      ctx.fillText('M/N::' + String(Math.floor(now / 125 + i * 49) % 1000).padStart(3, '0'), x, y);
    }
    const band = Math.floor((now / 5200) % 3);
    if (band === 1) {
      const start = ((now / 13) % Math.max(1, height));
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(' + red + ',' + (.16 - i * .04) + ')';
        ctx.fillRect(0, start + i * 9, width * random(.35, .8), 1.5);
      }
    }
  }
  function stop() {
    active = false;
    if (handle) cancelAnimationFrame(handle);
    if (timeout) clearTimeout(timeout);
    handle = 0;
    timeout = 0;
  }
  function frame(time) {
    handle = 0;
    if (!active) return;
    paint(time);
    timeout = window.setTimeout(() => {
      timeout = 0;
      if (active) handle = requestAnimationFrame(frame);
    }, mobile() ? 110 : 75);
  }
  function synchronize() {
    const allowed = enabled && !motion.matches;
    const shouldAnimate = allowed && !document.hidden;
    canvas.hidden = !allowed;
    button.setAttribute('aria-pressed', String(allowed));
    button.disabled = motion.matches;
    const display = motion.matches ? 'FX REDUCED' : allowed ? 'GLITCH ON' : 'GLITCH OFF';
    label.textContent = display;
    button.title = motion.matches ? 'Animation disabled by your system accessibility preference' : allowed ? 'Pause background glitch animation' : 'Resume background glitch animation';
    button.setAttribute('aria-label', button.title);
    if (!shouldAnimate) {
      stop();
      return;
    }
    if (!active) {
      active = true;
      resize();
      handle = requestAnimationFrame(frame);
    }
  }
  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (_) {}
    synchronize();
  });
  document.addEventListener('visibilitychange', synchronize);
  window.addEventListener('resize', () => {
    if (active) resize();
  }, { passive: true });
  if (motion.addEventListener) motion.addEventListener('change', synchronize);
  else if (motion.addListener) motion.addListener(synchronize);
  synchronize();
})();
