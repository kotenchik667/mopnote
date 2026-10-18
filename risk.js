(function (root, factory) {
  const output = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = output;
  root.MopnoteRisk = output;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({
    loadedWage: 22, supplies: 8, overhead: 10, travelCost: 5,
    paymentPct: 2.9, targetMargin: 25, timeCV: 22,
    weeklyJobs: 5, availableHours: 35
  });
  const clamp = (x, fallback, lo, hi) => {
    if (x === '' || x === undefined || x === null) return fallback;
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  };
  function normalize(input) {
    const x = input && typeof input === 'object' ? input : {};
    const c = {};
    for (const key of Object.keys(defaults)) {
      const max = key.endsWith('Pct') || key === 'targetMargin' || key === 'timeCV' ? 80 :
        key === 'weeklyJobs' ? 300 : key === 'availableHours' ? 168 : 100000;
      c[key] = clamp(x[key], defaults[key], 0, max);
    }
    c.availableHours = Math.max(1, c.availableHours);
    return c;
  }
  function normalCDF(x) {
    if (x > 8) return 1;
    if (x < -8) return 0;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const tail = density * (0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3 - 1.821255978 * t ** 4 + 1.330274429 * t ** 5);
    return x >= 0 ? 1 - tail : tail;
  }
  function model(estimate, settings) {
    const c = normalize(settings);
    const revenue = Math.max(0, Number(estimate.subtotal) || 0);
    const hours = Math.max(0, Number(estimate.laborHours) || 0);
    const elapsed = Math.max(0, Number(estimate.elapsedHours) || 0);
    const variableLabor = hours * c.loadedWage;
    const fixed = c.supplies + c.overhead + c.travelCost;
    const payment = revenue * c.paymentPct / 100;
    const totalCost = variableLabor + fixed + payment;
    const contribution = revenue - totalCost;
    const margin = revenue > 0 ? contribution / revenue * 100 : 0;
    const denominator = 1 - c.targetMargin / 100 - c.paymentPct / 100;
    const targetPrice = denominator > 0 ? (variableLabor + fixed) / denominator : null;
    const hourlySensitivity = denominator > 0 ? hours / denominator : null;
    const sigmaHours = hours * c.timeCV / 100;
    const scenarioHours = hours + 1.2815515655446004 * sigmaHours;
    const p90Cost = scenarioHours * c.loadedWage + fixed + payment;
    const adjustedMargin = revenue > 0 ? (revenue - p90Cost) / revenue * 100 : 0;
    const breakEvenHours = c.loadedWage > 0 ? (revenue - fixed - payment) / c.loadedWage : null;
    const profitProbability = sigmaHours > 0 && c.loadedWage > 0
      ? normalCDF((revenue - fixed - payment - variableLabor) / (c.loadedWage * sigmaHours))
      : contribution >= 0 ? 1 : 0;
    const rho = c.weeklyJobs * elapsed / c.availableHours;
    const wait = rho >= 1 ? null : (c.weeklyJobs / c.availableHours) *
      (elapsed * elapsed * (1 + (c.timeCV / 100) ** 2)) / (2 * (1 - rho));
    return {
      inputs: c, revenue, hours, elapsed, variableLabor, fixed, payment, totalCost, contribution,
      margin, targetPrice, gap: targetPrice === null ? null : Math.max(0, targetPrice - revenue),
      hourlySensitivity, scenarioHours, p90Cost, adjustedMargin, breakEvenHours,
      profitProbability, utilization: rho, waitHours: wait,
      flags: [
        ...(contribution < 0 ? ['BASE QUOTE BELOW COST'] : []),
        ...(targetPrice !== null && targetPrice > revenue ? ['MARGIN BELOW TARGET'] : []),
        ...(rho >= 1 ? ['CREW CAPACITY EXCEEDED'] : []),
        ...(rho > .85 && rho < 1 ? ['CREW NEAR CAPACITY'] : [])
      ]
    };
  }
  return Object.freeze({ defaults, normalize, normalCDF, model });
});
