(function (root, factory) {
  const engine = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  root.MopnoteEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({
    business: 'Your cleaning business', phone: '', currency: '$', booking: '',
    minimum: 75, bedroom: 25, bathroom: 30, per100: 8,
    kitchen: 35, living: 25, oven: 20, fridge: 20, windows: 25, pets: 15,
    deep: 1.45, moving: 1.7, moderate: 1.18, heavy: 1.45,
    weekly: 15, biweekly: 10, monthly: 5, variance: 10,
    travel: 0, tax: 0, labor: 20, crew: 1
  });
  const extras = Object.freeze({
    kitchen: { label: 'Kitchen', hours: .6 },
    living: { label: 'Living room', hours: .35 },
    oven: { label: 'Inside oven', hours: .4 },
    fridge: { label: 'Inside fridge', hours: .35 },
    windows: { label: 'Interior windows', hours: .6 },
    pets: { label: 'Pet hair', hours: .35 }
  });
  const multiplierKeys = ['deep', 'moving', 'moderate', 'heavy'];
  const discountKeys = ['weekly', 'biweekly', 'monthly'];
  const textKeys = ['business', 'phone', 'currency', 'booking'];
  const val = (v, fallback, min, max) => {
    const n = Number(v);
    return v === '' || v === null || v === undefined || !Number.isFinite(n)
      ? fallback : Math.min(max, Math.max(min, n));
  };
  const money = (number, symbol) => (symbol || '$') + Math.round(number).toLocaleString('en-US');
  function safeUrl(v) {
    try { const u = new URL(String(v)); return u.protocol === 'https:' && u.hostname ? u.href : ''; }
    catch (_) { return ''; }
  }
  function normalizeConfig(raw) {
    const out = { ...defaults };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const key of Object.keys(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (textKeys.includes(key)) {
        const limit = key === 'business' ? 70 : key === 'booking' ? 350 : key === 'phone' ? 28 : 4;
        out[key] = typeof raw[key] === 'string' ? raw[key].trim().slice(0, limit) : defaults[key];
      } else {
        const min = multiplierKeys.includes(key) || key === 'crew' ? 1 : 0;
        const max = multiplierKeys.includes(key) ? 8 : discountKeys.includes(key) ? 70 :
          key === 'variance' || key === 'tax' ? 40 : key === 'crew' ? 20 : 100000;
        out[key] = val(raw[key], defaults[key], min, max);
      }
    }
    out.currency = out.currency.replace(/[<>&"'\x60]/g, '') || '$';
    out.phone = out.phone.replace(/\D/g, '').slice(0, 15);
    out.booking = safeUrl(out.booking);
    out.crew = Math.round(out.crew);
    return out;
  }
  function normalizeQuote(raw) {
    const q = raw || {};
    const list = Array.isArray(q.extras) ? q.extras.filter(k => Object.hasOwn(extras, k)) : ['kitchen', 'living'];
    return {
      beds: Math.round(val(q.beds, 2, 0, 30)),
      baths: Math.round(val(q.baths, 1, 0, 30)),
      sqft: val(q.sqft, 0, 0, 100000),
      scope: q.scope === 'whole' ? 'whole' : 'selected',
      service: ['regular', 'deep', 'moving'].includes(q.service) ? q.service : 'regular',
      condition: ['normal', 'moderate', 'heavy'].includes(q.condition) ? q.condition : 'normal',
      frequency: ['once', 'weekly', 'biweekly', 'monthly'].includes(q.frequency) ? q.frequency : 'once',
      extras: [...new Set(list)]
    };
  }
  function calculate(configInput, quoteInput) {
    const c = normalizeConfig(configInput);
    const q = normalizeQuote(quoteInput);
    const roomBase = q.beds * c.bedroom + q.baths * c.bathroom;
    const areaFloor = q.scope === 'whole' && q.sqft > 0 ? q.sqft / 100 * c.per100 : 0;
    const floorTopUp = Math.max(0, areaFloor - roomBase);
    const selected = q.extras.map(key => ({ key, label: extras[key].label, cost: c[key], hours: extras[key].hours }));
    const extraTotal = selected.reduce((sum, item) => sum + item.cost, 0);
    const unadjusted = roomBase + floorTopUp + extraTotal;
    const minimumTopUp = Math.max(0, c.minimum - unadjusted);
    const base = unadjusted + minimumTopUp;
    const serviceMult = q.service === 'deep' ? c.deep : q.service === 'moving' ? c.moving : 1;
    const conditionMult = q.condition === 'moderate' ? c.moderate : q.condition === 'heavy' ? c.heavy : 1;
    const serviceAdded = base * (serviceMult - 1);
    const afterService = base + serviceAdded;
    const conditionAdded = afterService * (conditionMult - 1);
    const beforeDiscount = afterService + conditionAdded;
    const discountedFrequency = q.service === 'regular' ? q.frequency : 'once';
    const discountRate = discountedFrequency === 'once' ? 0 : c[discountedFrequency] / 100;
    const discount = beforeDiscount * discountRate;
    const discountFloor = Math.max(0, c.minimum - (beforeDiscount - discount));
    const subtotal = Math.max(c.minimum, beforeDiscount - discount) + c.travel;
    const tax = subtotal * c.tax / 100;
    const center = subtotal + tax;
    const low = Math.max(0, Math.round(center * (1 - c.variance / 100)));
    const high = Math.max(low, Math.round(center * (1 + c.variance / 100)));
    const taskHours = .45 + q.beds * .55 + q.baths * .7 +
      selected.reduce((sum, item) => sum + item.hours, 0);
    const laborHours = taskHours * serviceMult * conditionMult;
    const elapsedHours = laborHours / c.crew;
    const laborCost = laborHours * c.labor;
    const remainder = subtotal - laborCost;
    const breakdown = [
      { label: 'Bedrooms and bathrooms', value: roomBase },
      ...(floorTopUp ? [{ label: 'Whole-home size adjustment', value: floorTopUp }] : []),
      ...selected.map(item => ({ label: item.label, value: item.cost })),
      ...(minimumTopUp ? [{ label: 'Minimum charge adjustment', value: minimumTopUp }] : []),
      ...(serviceAdded ? [{ label: 'Service intensity', value: serviceAdded }] : []),
      ...(conditionAdded ? [{ label: 'Extra condition work', value: conditionAdded }] : []),
      ...(discount ? [{ label: 'Recurring discount', value: -discount }] : []),
      ...(discountFloor ? [{ label: 'Minimum charge floor', value: discountFloor }] : []),
      ...(c.travel ? [{ label: 'Travel / setup', value: c.travel }] : []),
      ...(tax ? [{ label: 'Tax', value: tax }] : [])
    ];
    const serviceName = q.service === 'deep' ? 'Deep cleaning' : q.service === 'moving' ? 'Move-in / move-out' : 'Standard cleaning';
    const frequencyName = discountedFrequency === 'weekly' ? 'Weekly' : discountedFrequency === 'biweekly' ? 'Every two weeks' : discountedFrequency === 'monthly' ? 'Monthly' : 'One-time';
    return { config: c, quote: q, low, high, center, subtotal, tax, laborHours, elapsedHours, laborCost, remainder,
      serviceName, frequencyName, discountRate, breakdown, selected };
  }
  function encodeConfig(raw) {
    const c = normalizeConfig(raw);
    const json = JSON.stringify({ v: 2, config: c });
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function decodeConfig(token) {
    if (typeof token !== 'string' || token.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid link');
    const padding = '='.repeat((4 - token.length % 4) % 4);
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/') + padding);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (raw && raw.v === 2 && raw.config) return normalizeConfig(raw.config);
    if (raw && typeof raw === 'object') {
      const legacy = {
        business: raw.business, phone: raw.phone, currency: raw.currency,
        minimum: raw.minimum, bedroom: raw.bedCost, bathroom: raw.bathCost,
        kitchen: raw.kitchenCost, living: raw.livingCost, oven: raw.ovenCost,
        fridge: raw.fridgeCost, windows: raw.windowsCost, pets: raw.petsCost,
        deep: raw.deepMultiplier, moving: raw.movingMultiplier
      };
      return normalizeConfig(Object.fromEntries(Object.entries(legacy).filter(([, v]) => v !== undefined)));
    }
    throw new Error('Invalid link');
  }
  return Object.freeze({ defaults, extras, normalizeConfig, normalizeQuote, calculate, money, safeUrl, encodeConfig, decodeConfig });
});
