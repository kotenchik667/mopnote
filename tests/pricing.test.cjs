const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('default quote is nonnegative and ordered', () => {
  const r = E.calculate(E.defaults, { beds: 2, baths: 1, extras: ['kitchen', 'living'] });
  assert.ok(r.low <= r.center && r.center <= r.high);
  assert.ok(r.center >= 75);
});

test('whole home floor guard only applies when selected', () => {
  const config = { ...E.defaults, per100: 25 };
  const q = { beds: 1, baths: 1, sqft: 4000, extras: [] };
  const selected = E.calculate(config, { ...q, scope: 'selected' });
  const whole = E.calculate(config, { ...q, scope: 'whole' });
  assert.ok(whole.center > selected.center);
});

test('deep and heavy jobs cost more than maintained standard jobs', () => {
  const quote = { beds: 3, baths: 2, extras: ['kitchen'] };
  const regular = E.calculate(E.defaults, { ...quote, service: 'regular', condition: 'normal' });
  const deep = E.calculate(E.defaults, { ...quote, service: 'deep', condition: 'heavy' });
  assert.ok(deep.center > regular.center);
});

test('recurring discounts only apply to standard jobs', () => {
  const standardOnce = E.calculate(E.defaults, { frequency: 'once' });
  const standardWeekly = E.calculate(E.defaults, { frequency: 'weekly' });
  const deepOnce = E.calculate(E.defaults, { service: 'deep', frequency: 'once' });
  const deepWeekly = E.calculate(E.defaults, { service: 'deep', frequency: 'weekly' });
  assert.ok(standardWeekly.center < standardOnce.center);
  assert.equal(deepWeekly.center, deepOnce.center);
});

test('broken numeric input cannot make infinite or negative quotes', () => {
  const r = E.calculate({ minimum: -100, bedroom: Infinity, variance: 100000, deep: -9 }, { beds: 99999, baths: -100, sqft: Infinity, service: 'deep' });
  assert.ok(Number.isFinite(r.center));
  assert.ok(r.low >= 0);
  assert.ok(r.high >= r.low);
  assert.ok(r.quote.beds <= 30 && r.quote.baths >= 0);
});

test('customer links can round-trip Unicode business names', () => {
  const original = { ...E.defaults, business: 'Алматы клининг', currency: '₸', phone: '+7 (700) 123 45 67' };
  const recovered = E.decodeConfig(E.encodeConfig(original));
  assert.equal(recovered.business, original.business);
  assert.equal(recovered.currency, original.currency);
  assert.equal(recovered.phone, '77001234567');
});

test('legacy links still decode their prices', () => {
  const raw = { business: 'Old clean', bedCost: 42, deepMultiplier: 1.9 };
  const bytes = new TextEncoder().encode(JSON.stringify(raw));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const loaded = E.decodeConfig(token);
  assert.equal(loaded.bedroom, 42);
  assert.equal(loaded.deep, 1.9);
});

test('unsafe booking urls are rejected', () => {
  assert.equal(E.safeUrl('javascript:alert(1)'), '');
  assert.equal(E.safeUrl('http://example.org'), '');
  assert.equal(E.safeUrl('https://example.org/book'), 'https://example.org/book');
});

test('price breakdown adds up to expected center', () => {
  const r = E.calculate({ ...E.defaults, tax: 7, travel: 5 }, { beds: 3, baths: 2, condition: 'moderate', frequency: 'weekly', extras: ['kitchen', 'oven'] });
  const sum = r.breakdown.reduce((total, row) => total + row.value, 0);
  assert.ok(Math.abs(sum - r.center) < 0.00001);
});
