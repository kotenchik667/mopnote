const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

test('all element references used by the app exist in the page', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), 'Missing ' + match[1]);
});

test('all business pricing controls and quote extras remain present', () => {
  const engine = require('../engine.js');
  for (const key of Object.keys(engine.defaults)) {
    assert.ok(html.includes('data-cfg="' + key + '"'), 'Missing rate control: ' + key);
  }
  for (const key of Object.keys(engine.extras)) {
    assert.ok(html.includes('data-extra="' + key + '"'), 'Missing extra: ' + key);
  }
});

test('redesign contains working mobile, print and accessibility paths', () => {
  assert.match(html, /id="mobileEstimate"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /class="skip"/);
  assert.match(css, /@media\(max-width:610px\)/);
  assert.match(css, /@media print/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /id="preferredDate" type="date"/);
});

test('new style rejects default faux SaaS decoration', () => {
  assert.doesNotMatch(css, /box-shadow\s*:/);
  assert.doesNotMatch(css, /border-radius\s*:/);
  assert.doesNotMatch(css, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(html, /class="how-grid"|class="preview-window"/);
  assert.doesNotMatch(html, /fonts\.googleapis/);
});
