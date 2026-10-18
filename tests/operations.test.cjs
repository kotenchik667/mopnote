const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const Risk = require('../risk.js');
const Guidance = require('../guidance.js');

test('model reports exact contribution after all explicit costs', () => {
  const estimate = E.calculate(E.defaults, {beds:2,baths:1,extras:['kitchen','living']});
  const m = Risk.model(estimate,{loadedWage:20,supplies:12,overhead:8,travelCost:5,paymentPct:3,targetMargin:20,timeCV:20});
  assert.ok(Math.abs(m.totalCost-(m.hours*20+25+m.revenue*.03))<1e-8);
  assert.ok(Math.abs(m.margin-100*(m.revenue-m.totalCost)/m.revenue)<1e-8);
  assert.ok(Number.isFinite(m.targetPrice));
  assert.ok(m.scenarioHours>m.hours);
});

test('target price responds monotonically to costs and required margin', () => {
  const e = E.calculate(E.defaults, {beds:3,baths:2,extras:[]});
  const base = Risk.model(e,{loadedWage:20,targetMargin:20});
  const wage = Risk.model(e,{loadedWage:30,targetMargin:20});
  const margin = Risk.model(e,{loadedWage:20,targetMargin:30});
  assert.ok(wage.targetPrice>base.targetPrice);
  assert.ok(margin.targetPrice>base.targetPrice);
  assert.ok(base.hourlySensitivity>0);
});

test('mathematical derivative matches finite difference', () => {
  const e = E.calculate(E.defaults, {beds:2,baths:1,extras:['kitchen']});
  const x = Risk.model(e,{loadedWage:21.5,paymentPct:3,targetMargin:25});
  const y = Risk.model(e,{loadedWage:21.501,paymentPct:3,targetMargin:25});
  assert.ok(Math.abs((y.targetPrice-x.targetPrice)/.001-x.hourlySensitivity)<1e-6);
});

test('risk normal distribution approximation and capacity overload', () => {
  assert.ok(Math.abs(Risk.normalCDF(0)-.5)<1e-6);
  assert.ok(Risk.normalCDF(-2)<.03 && Risk.normalCDF(2)>.97);
  const e = E.calculate(E.defaults,{beds:5,baths:5,extras:['kitchen','windows']});
  const overloaded = Risk.model(e,{weeklyJobs:40,availableHours:10});
  assert.ok(overloaded.utilization>1);
  assert.equal(overloaded.waitHours,null);
  assert.ok(overloaded.flags.includes('CREW CAPACITY EXCEEDED'));
});

test('private labor wage is omitted from newly shared customer links', () => {
  const cfg = {...E.defaults,labor:82731,phone:'15551234567',business:'Test Cleaner'};
  const token = E.encodeConfig(cfg);
  const decoded = E.decodeConfig(token);
  assert.equal(decoded.labor,E.defaults.labor);
  assert.equal(decoded.phone,cfg.phone);
  assert.ok(!token.includes('82731'));
});

test('BM25 retrieval produces relevant cited documents and no hallucinated answer', () => {
  const hits = Guidance.retrieve('whole home selected bathrooms kitchen rooms',3);
  assert.ok(hits.length>0);
  assert.ok(hits.some(h=>h.id==='scope'));
  assert.ok(hits.every(h=>/^https:\/\/www\.reddit\.com\//.test(h.url)));
  assert.deepEqual(Guidance.retrieve(''),[]);
  const only = Guidance.retrieve('overhead payroll supplies travel',2);
  assert.ok(only.some(h=>h.id==='cost'));
});

test('risk input limits prevent invalid probabilities and NaN', () => {
  const e = E.calculate(E.defaults,{beds:2,baths:1});
  const m=Risk.model(e,{loadedWage:-20,availableHours:0,weeklyJobs:Infinity,timeCV:900});
  assert.ok(Number.isFinite(m.totalCost));
  assert.ok(m.profitProbability>=0&&m.profitProbability<=1);
  assert.ok(m.inputs.availableHours>=1);
});
