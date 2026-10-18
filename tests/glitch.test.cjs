const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('glitch.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const script = fs.readFileSync('glitch.js', 'utf8');

function mount(initialPreference = null) {
  const calls = { raf: [], cancelled: [], timeouts: [], cleared: [] };
  const events = {};
  const media = { matches: false, addEventListener(_, handler) { events.motion = handler; } };
  const noop = () => {};
  const context = { clearRect: noop, lineTo: noop, moveTo: noop, beginPath: noop, stroke: noop, fillRect: noop, fillText: noop, setTransform: noop };
  const canvas = { hidden: false, getContext: () => context, width: 0, height: 0 };
  const button = { attrs: {}, disabled: false, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(_, fn) { events.click = fn; } };
  const label = { textContent: '' };
  const elements = { glitchCanvas: canvas, glitchToggle: button, glitchLabel: label };
  const document = { hidden: false, documentElement: { dataset: {} }, getElementById: id => elements[id], addEventListener(k, fn) { events[k] = fn; } };
  const local = { value: initialPreference, getItem() { return this.value; }, setItem(_, v) { this.value = v; } };
  const window = {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => media, addEventListener(k, fn) { events[k] = fn; },
    setTimeout(fn) { calls.timeouts.push(fn); return calls.timeouts.length; }
  };
  const globals = {
    window, document, localStorage: local, Math,
    requestAnimationFrame: fn => { calls.raf.push(fn); return calls.raf.length; },
    cancelAnimationFrame: id => calls.cancelled.push(id),
    clearTimeout: id => calls.cleared.push(id)
  };
  vm.runInNewContext(script, globals, { timeout: 1000 });
  return { calls, events, media, canvas, button, label, document, local, context };
}

test('background animation is installed and cannot intercept form taps', () => {
  assert.match(html, /id="glitchCanvas"/);
  assert.match(html, /id="glitchToggle"/);
  assert.match(html, /glitch\.js\?v=4/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(sw, /mopnote-v4-glitch/);
  assert.match(sw, /'\.\/glitch\.js'/);
  assert.match(sw, /'\.\/glitch\.css'/);
});

test('animation starts, draws a frame and can be disabled', () => {
  const { button, canvas, events, calls, local } = mount();
  assert.equal(canvas.hidden, false);
  assert.equal(button.attrs['aria-pressed'], 'true');
  assert.equal(calls.raf.length, 1);
  assert.doesNotThrow(() => calls.raf[0](100));
  assert.equal(calls.timeouts.length, 1);
  events.click();
  assert.equal(button.attrs['aria-pressed'], 'false');
  assert.equal(canvas.hidden, true);
  assert.equal(local.value, 'off');
  events.click();
  assert.equal(canvas.hidden, false);
  assert.equal(button.attrs['aria-pressed'], 'true');
});

test('system reduced-motion preference disables the background', () => {
  const { button, canvas, media, events, calls } = mount();
  media.matches = true;
  events.motion();
  assert.equal(button.disabled, true);
  assert.equal(canvas.hidden, true);
  assert.equal(button.attrs['aria-pressed'], 'false');
  assert.ok(calls.cancelled.length > 0);
  media.matches = false;
  events.motion();
  assert.equal(button.disabled, false);
  assert.equal(canvas.hidden, false);
});

test('inactive browser tabs stop drawing and saved off state persists', () => {
  const paused = mount('off');
  assert.equal(paused.canvas.hidden, true);
  assert.equal(paused.calls.raf.length, 0);
  const active = mount();
  active.document.hidden = true;
  active.events.visibilitychange();
  assert.ok(active.calls.cancelled.length > 0);
  active.document.hidden = false;
  active.events.visibilitychange();
  assert.ok(active.calls.raf.length >= 2);
});
