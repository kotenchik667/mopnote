(function () {
  'use strict';
  const E = window.MopnoteEngine;
  if (!E) {
    document.body.textContent = 'Mopnote could not load its pricing engine. Please refresh.';
    return;
  }
  const $ = id => document.getElementById(id);
  const cfgFields = Array.from(document.querySelectorAll('[data-cfg]'));
  const extraFields = Array.from(document.querySelectorAll('[data-extra]'));
  const quoteIds = ['beds', 'baths', 'sqft', 'scope', 'service', 'condition', 'frequency'];
  const detailIds = ['clientName', 'preferredDate', 'clientArea', 'clientNotes'];
  const storageKey = 'mopnote:studio:v2';
  const themeKey = 'mopnote:theme';
  const validPhone = number => /^\d{8,15}$/.test(number);
  function readStored() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return E.normalizeConfig(raw);
    } catch (_) { return E.normalizeConfig(); }
  }
  let config = readStored();
  let customer = false;
  let badLink = false;
  const hash = location.hash;
  if (hash.startsWith('#p=')) {
    try {
      config = E.decodeConfig(hash.slice(3));
      customer = true;
    } catch (_) { badLink = true; }
  }
  function saveConfig() {
    if (customer) return;
    try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch (_) {}
  }
  function setStatus(target, message) {
    $(target).textContent = message;
  }
  function fillConfig() {
    for (const node of cfgFields) node.value = String(config[node.dataset.cfg] ?? '');
  }
  function readQuote() {
    const obj = Object.fromEntries(quoteIds.map(id => [id, $(id).value]));
    obj.extras = extraFields.filter(el => el.checked).map(el => el.dataset.extra);
    return obj;
  }
  function details() {
    return Object.fromEntries(detailIds.map(id => [id, ($(id).value || '').trim()]));
  }
  function createLine(label, value) {
    const div = document.createElement('div');
    const title = document.createElement('span');
    const amount = document.createElement('strong');
    div.className = 'breakdown-line';
    title.textContent = label;
    amount.textContent = value;
    div.append(title, amount);
    return div;
  }
  let last = E.calculate(config, readQuote());
  function refresh() {
    last = E.calculate(config, readQuote());
    const r = last;
    const fmt = n => E.money(n, r.config.currency);
    const range = fmt(r.low) + '–' + fmt(r.high);
    $('price').textContent = range;
    $('mobilePrice').textContent = range;
    $('heroPrice').textContent = range;
    $('resultService').textContent = r.serviceName;
    $('roomCount').textContent = r.quote.beds + ' bed · ' + r.quote.baths + ' bath' + (r.selected.length ? ' · ' + r.selected.length + ' extras' : '');
    $('quoteBusiness').textContent = 'Prepared for ' + (r.config.business || 'your cleaning business');
    $('formTitle').textContent = customer ? 'Your space. Your estimate.' : 'Tell us about your space.';
    $('duration').textContent = '~' + r.elapsedHours.toFixed(1) + ' h · ' + r.config.crew + ' cleaner' + (r.config.crew === 1 ? '' : 's');
    $('visitCaption').textContent = r.frequencyName + ' · estimated price per visit';
    $('frequencyNote').textContent = r.quote.service === 'regular'
      ? 'Recurring discounts estimate each future standard visit. The first clean may cost more.'
      : 'Recurring discounts apply to standard cleaning only. This service is estimated as a one-time visit.';
    $('laborCost').textContent = fmt(r.laborCost);
    $('remainder').textContent = (r.remainder < 0 ? '−' : '') + fmt(Math.abs(r.remainder));
    $('breakdown').replaceChildren(...r.breakdown.map(item => createLine(item.label, (item.value < 0 ? '−' : '') + fmt(Math.abs(item.value)))));
    $('sendBtn').disabled = !validPhone(r.config.phone);
    $('sendBtn').textContent = validPhone(r.config.phone) ? 'Ask about availability ↗' : 'WhatsApp not set up';
    const link = E.safeUrl(r.config.booking);
    $('bookBtn').hidden = !link;
    if (link) $('bookBtn').href = link;
    $('disclaimer').textContent = validPhone(r.config.phone)
      ? 'Indicative range only. Your cleaner confirms the final price and availability. Mopnote does not collect your details.'
      : 'No WhatsApp number is configured. Copy your estimate and contact the business directly. This is not a booking.';
    if (badLink) setStatus('quoteStatus', 'That customer link could not be opened. Request a new link from the business.');
    $('businessMetrics').hidden = customer || $('studioPanel').hidden;
    document.title = customer ? (r.config.business || 'Cleaning') + ' | Mopnote estimate' : 'Mopnote — turn an enquiry into a clear estimate';
  }
  function changeMode(mode, scroll) {
    const studio = mode === 'studio' && !customer;
    $('studioPanel').hidden = !studio;
    $('quotePanel').hidden = studio;
    $('quoteTab').classList.toggle('active', !studio);
    $('studioTab').classList.toggle('active', studio);
    $('quoteTab').setAttribute('aria-pressed', String(!studio));
    $('studioTab').setAttribute('aria-pressed', String(studio));
    document.body.dataset.mode = studio ? 'studio' : 'quote';
    refresh();
    if (scroll) $('workspace').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function buildMessage() {
    const r = last;
    const d = details();
    const fmt = n => E.money(n, r.config.currency);
    const lines = [
      'Hi ' + (r.config.business || 'there') + ', I would like a cleaning estimate.',
      '',
      'Service: ' + r.serviceName,
      'Bedrooms: ' + r.quote.beds,
      'Bathrooms: ' + r.quote.baths,
      'Scope: ' + (r.quote.scope === 'whole' ? 'Whole home' : 'Selected rooms'),
      ...(r.quote.sqft ? ['Floor area: ' + r.quote.sqft + ' sq ft'] : []),
      'Condition: ' + ({ normal: 'Generally maintained', moderate: 'Extra attention', heavy: 'Heavy buildup' })[r.quote.condition],
      'Frequency: ' + r.frequencyName,
      'Extras: ' + (r.selected.map(item => item.label).join(', ') || 'None'),
      'Online estimate: ' + fmt(r.low) + '–' + fmt(r.high),
      ...(d.clientName ? ['Name: ' + d.clientName] : []),
      ...(d.preferredDate ? ['Preferred date: ' + d.preferredDate] : []),
      ...(d.clientArea ? ['Area: ' + d.clientArea] : []),
      ...(d.clientNotes ? ['Notes: ' + d.clientNotes] : []),
      '',
      'Could you confirm availability and the final price?'
    ];
    return lines.join('\n');
  }
  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {}
    const node = document.createElement('textarea');
    node.value = value;
    node.setAttribute('readonly', '');
    node.style.position = 'fixed';
    node.style.opacity = '0';
    document.body.append(node);
    node.select();
    let worked = false;
    try { worked = document.execCommand('copy'); } catch (_) {}
    node.remove();
    return worked;
  }
  function linkForCustomers() {
    return location.origin + location.pathname + '#p=' + E.encodeConfig(config);
  }
  $('sendBtn').addEventListener('click', () => {
    const phone = last.config.phone;
    if (!validPhone(phone)) { setStatus('quoteStatus', 'Add a valid WhatsApp number in Business studio first.'); return; }
    const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(buildMessage());
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatus('quoteStatus', 'WhatsApp opened with your quote details. Sending the message is your choice.');
  });
  $('copyBtn').addEventListener('click', async () => {
    setStatus('quoteStatus', await copyText(buildMessage()) ? 'Estimate copied.' : 'Copy failed. Please try another browser.');
  });
  $('printBtn').addEventListener('click', () => window.print());
  $('shareBtn').addEventListener('click', async () => {
    const url = linkForCustomers();
    const ok = await copyText(url);
    setStatus('studioStatus', ok
      ? 'Customer link copied. ' + (!validPhone(config.phone) ? 'Add your WhatsApp number to receive enquiries.' : 'Open it in a private tab to test it.')
      : 'Could not copy. Please open this page on HTTPS and try again.');
  });
  $('embedBtn').addEventListener('click', async () => {
    const url = linkForCustomers().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const code = '<iframe src="' + url + '" title="Cleaning estimate" loading="lazy" style="width:100%;min-height:950px;border:0;border-radius:18px"></iframe>';
    setStatus('studioStatus', await copyText(code) ? 'Embed code copied. Paste it into a page that supports HTML.' : 'Could not copy the embed code.');
  });
  $('downloadBtn').addEventListener('click', () => {
    const file = new Blob([JSON.stringify({ version: 2, config }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mopnote-business-settings.json';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('studioStatus', 'Your setup was downloaded. The file contains public pricing information and your contact details.');
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Reset all business settings? This cannot be undone unless you have an exported copy.')) return;
    config = E.normalizeConfig();
    fillConfig();
    saveConfig();
    refresh();
    setStatus('studioStatus', 'Business settings reset to defaults.');
  });
  $('studioTab').addEventListener('click', () => changeMode('studio', false));
  $('quoteTab').addEventListener('click', () => changeMode('quote', false));
  $('demoAction').addEventListener('click', () => changeMode('quote', true));
  ['heroAction', 'navAction', 'bottomAction'].forEach(id => $(id).addEventListener('click', () => changeMode(customer ? 'quote' : 'studio', false)));
  $('mobileSee').addEventListener('click', () => $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  quoteIds.forEach(id => {
    $(id).addEventListener('input', refresh);
    $(id).addEventListener('change', refresh);
  });
  extraFields.forEach(field => field.addEventListener('change', refresh));
  cfgFields.forEach(field => {
    field.addEventListener('input', () => {
      config[field.dataset.cfg] = field.value;
      config = E.normalizeConfig(config);
      saveConfig();
      refresh();
      setStatus('studioStatus', 'Saved in this browser. Copy your customer link to publish changes.');
    });
    field.addEventListener('blur', () => { field.value = String(config[field.dataset.cfg]); });
  });
  const theme = (() => { try { return localStorage.getItem(themeKey); } catch (_) { return null; } })();
  function setTheme(isDark) {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    $('themeToggle').setAttribute('aria-pressed', String(isDark));
    $('themeToggle').setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    $('themeToggle').firstElementChild.textContent = isDark ? '☀' : '◐';
    try { localStorage.setItem(themeKey, isDark ? 'dark' : 'light'); } catch (_) {}
  }
  setTheme(theme === 'dark');
  $('themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  $('preferredDate').min = y + '-' + m + '-' + day;
  fillConfig();
  if (customer) {
    document.body.classList.add('customer-mode');
    $('studioTab').hidden = true;
    $('navAction').textContent = 'Your estimate ↗';
    $('heroAction').textContent = 'Get my estimate ↗';
    $('bottomAction').textContent = 'See your estimate ↗';
    $('demoAction').hidden = true;
    $('heroAction').setAttribute('href', '#workspace');
    $('studioPanel').hidden = true;
    $('quotePanel').hidden = false;
    changeMode('quote', false);
    requestAnimationFrame(() => $('workspace').scrollIntoView({ block: 'start' }));
  } else {
    changeMode('studio', false);
  }
})();
