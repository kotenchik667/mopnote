(() => {
  'use strict';
  const E = window.MopnoteEngine, R = window.MopnoteRisk, G = window.MopnoteGuidance;
  if (!E || !R || !G) return;
  const $ = id => document.getElementById(id);
  const fields = [...document.querySelectorAll('[data-risk]')];
  const key = 'mopnote:risk:v1';
  let settings = { ...R.defaults };
  try {
    const item = JSON.parse(localStorage.getItem(key) || 'null');
    if (item) settings = R.normalize(item);
  } catch (_) {}
  for (const field of fields) field.value = String(settings[field.dataset.risk]);
  function collect() {
    const cfg = Object.fromEntries([...document.querySelectorAll('[data-cfg]')].map(el => [el.dataset.cfg, el.value]));
    const q = Object.fromEntries(['beds','baths','sqft','scope','service','condition','frequency'].map(id => [id,$(id).value]));
    q.extras = [...document.querySelectorAll('[data-extra]:checked')].map(el => el.dataset.extra);
    return E.calculate(cfg, q);
  }
  function update() {
    const estimate = collect();
    const m = R.model(estimate, settings);
    const money = n => E.money(n, estimate.config.currency);
    $('opsMargin').textContent = m.margin.toFixed(1) + '%';
    $('opsTarget').textContent = m.targetPrice === null ? 'UNATTAINABLE' : money(m.targetPrice);
    $('opsP90').textContent = m.scenarioHours.toFixed(1) + ' labor-hours';
    $('opsCover').textContent = (m.profitProbability * 100).toFixed(1) + '% *';
    $('opsUtil').textContent = (m.utilization * 100).toFixed(1) + '%';
    $('opsQueue').textContent = m.waitHours === null ? 'OVER CAPACITY' : m.waitHours.toFixed(1) + ' h';
    $('opsDerivative').textContent = m.hourlySensitivity === null ? 'N/A' : '+' + money(m.hourlySensitivity);
    $('opsWarning').textContent = m.flags.length ? m.flags.join(' / ') : 'MODELED COSTS COVERED — VERIFY WITH ACTUAL JOB DATA';
    const hasContact = /^\d{8,15}$/.test(estimate.config.phone) || !!E.safeUrl(estimate.config.booking);
    const hasBusinessName = estimate.config.business && estimate.config.business !== E.defaults.business;
    const sample = ['minimum','bedroom','bathroom','kitchen'].every(k => estimate.config[k] === E.defaults[k]);
    $('setupReadiness').textContent = [
      hasContact ? 'CONTACT ROUTE READY' : 'ACTION REQUIRED: ADD WHATSAPP OR AN HTTPS BOOKING PAGE',
      hasBusinessName ? 'BUSINESS NAMED' : 'ADD YOUR BUSINESS NAME',
      sample ? 'DEMO PRICES — REPLACE BEFORE COMMERCIAL USE' : 'CUSTOM PRICING SET'
    ].join(' · ');
  }
  for (const field of fields) {
    field.addEventListener('input', () => {
      settings = R.normalize({ ...settings, [field.dataset.risk]: field.value });
      try { localStorage.setItem(key, JSON.stringify(settings)); } catch (_) {}
      update();
    });
    field.addEventListener('blur', () => { field.value = String(settings[field.dataset.risk]); });
  }
  const note = document.createElement('span');
  note.textContent = '';
  const results = $('guideResults');
  function addResult(doc) {
    const entry = document.createElement('article');
    entry.className = 'guide-result';
    const head = document.createElement('strong');
    head.textContent = doc.question;
    const answer = document.createElement('p');
    answer.textContent = doc.answer;
    const source = document.createElement('a');
    source.href = doc.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'READ REDDIT DISCUSSION ↗';
    entry.append(head, answer, source);
    results.append(entry);
  }
  $('guideForm').addEventListener('submit', event => {
    event.preventDefault();
    const question = $('guideQuery').value.trim();
    const hits = G.retrieve(question, 3);
    results.replaceChildren();
    if (!hits.length) {
      const msg = document.createElement('p');
      msg.className = 'guide-empty';
      msg.textContent = 'No grounded material matches that wording. Try: labor, whole home, underpricing, or customer calls.';
      results.append(msg);
    } else {
      for (const hit of hits) addResult(hit);
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches('[data-cfg], #beds, #baths, #sqft, #scope, #service, #condition, #frequency')) update();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-extra], [data-cfg], #beds, #baths, #sqft, #scope, #service, #condition, #frequency')) update();
  });
  const originalRefresh = $('quoteTab');
  originalRefresh.addEventListener('click', update);
  $('studioTab').addEventListener('click', update);
  update();
})();
