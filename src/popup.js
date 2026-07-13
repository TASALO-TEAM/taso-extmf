// ═══════════════════════════════════════════════
//  TASALO — Popup Firefox Desktop
//  COPIA EXACTA de Android + source switch
// ═══════════════════════════════════════════════

import { PREFERRED_ORDER, CURRENCY_META, DEFAULT_TICKER_CURRENCIES, browser } from './constants.js';

let settings = {};
let currentRates = {};
let rateChanges = {};
let previousRates = {};
let binanceRates = {};
let tickerOpen = false;
let listenersAttached = false;

// ── Debounce ───────────────────────────────────
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (listenersAttached) return;
  listenersAttached = true;

  const uiState = await browser.storage.local.get('popupUiState');
  tickerOpen = (uiState.popupUiState && uiState.popupUiState.tickerOpen) ?? false;

  await loadData();
  applyTheme();
  applyColors();
  renderAll();
  renderSourceSwitch();
  attachListeners();
});

async function loadData() {
  const data = await browser.storage.local.get([
    'settings', 'currentRates',
    'eltoqueRates', 'bccRates', 'cadecaRates',
    'previousRates', 'rateChanges', 'binanceRates', 'lastUpdated', 'fetchError'
  ]);
  settings = data.settings ?? {};

  // FIX: antes, si la fuente elegida (ej. CADECA) no tenía datos válidos
  // todavía, este bloque caía silenciosamente a mostrar El Toque bajo la
  // etiqueta de la fuente elegida — pareciendo que "no cambiaba nada".
  // Ahora cada fuente muestra SOLO sus propios datos (o vacío si no hay).
  const pref = settings.sourcePreference || 'eltoque';
  currentRates = selectRatesForSource(pref, data);

  previousRates = data.previousRates ?? {};
  rateChanges   = data.rateChanges   ?? {};
  binanceRates  = data.binanceRates  ?? {};

  const errorBanner = document.getElementById('errorBanner');
  const errorMsg = document.getElementById('errorMsg');
  const loadingText = document.getElementById('ratesLoadingText');

  if (data.fetchError) {
    setDot('error');
    if (errorBanner) errorBanner.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = data.fetchError;
  } else if (Object.keys(currentRates).length > 0) {
    setDot('ok');
    if (errorBanner) errorBanner.style.display = 'none';
  } else {
    setDot('loading');
    if (errorBanner) errorBanner.style.display = 'none';
  }

  if (loadingText) {
    if (!data.fetchError && Object.keys(currentRates).length === 0) {
      const sourceNames = { eltoque: 'El Toque', bcc: 'BCC', cadeca: 'CADECA' };
      loadingText.textContent = `Sin datos de ${sourceNames[pref] || pref} por ahora`;
    } else {
      loadingText.textContent = 'Obteniendo tasas...';
    }
  }

  const updateInfo = document.getElementById('updateInfo');
  if (data.lastUpdated && updateInfo) {
    updateInfo.textContent = fmtTime(data.lastUpdated);
  }

  const iv = settings.updateInterval ?? 5;
  const footerInterval = document.getElementById('footerInterval');
  if (footerInterval) {
    footerInterval.textContent =
      `cada ${iv < 60 ? iv + ' min' : (iv / 60).toFixed(1) + ' h'}`;
  }
}

// Selecciona las tasas de la fuente activa únicamente — sin mezclarlas
// ni sustituirlas silenciosamente por otra fuente cuando faltan datos.
function selectRatesForSource(pref, data) {
  if (pref === 'bcc')     return data.bccRates    || {};
  if (pref === 'cadeca')  return data.cadecaRates || {};
  if (pref === 'eltoque') return data.eltoqueRates || {};
  return data.currentRates || {};
}

function setDot(state) {
  const dot = document.getElementById('updateDot');
  if (dot) dot.className = 'update-dot ' + state;
}

// ── Render principal ──────────────────────────
function renderAll() {
  const hasRates = Object.keys(currentRates).length > 0;
  const ratesLoading = document.getElementById('ratesLoading');
  const ratesGrid = document.getElementById('ratesGrid');

  if (ratesLoading) ratesLoading.style.display = hasRates ? 'none' : 'flex';
  if (ratesGrid) ratesGrid.style.display = hasRates ? 'grid' : 'none';

  if (hasRates) {
    renderGrid();
  }

  // El ticker de Binance es independiente de si la fuente elegida
  // (ElToque/BCC/CADECA) tiene datos — siempre se intenta renderizar.
  renderTicker();

  applyTickerState();
}

function getSourcePreference() {
  return settings.sourcePreference || 'eltoque';
}

// FIX: antes esto devolvía arrays fijos hardcodeados por fuente,
// ignorando qué monedas había seleccionado el usuario en Opciones si no
// estaban en la lista fija. Ahora se derivan directamente de las tasas
// reales que ya cargó loadData() para la fuente activa.
function getSourceCurrencies() {
  return Object.keys(currentRates);
}

function getSortedCurrencies() {
  const sourceCurrencies = getSourceCurrencies();
  const order = settings.currencyOrder?.length ? settings.currencyOrder : PREFERRED_ORDER;
  const selected = settings.selectedCurrencies ?? [];

  const filtered = sourceCurrencies.filter(cur =>
    Object.keys(currentRates).includes(cur)
  );

  const sorted = [...filtered].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return selected.length > 0 ? sorted.filter(c => selected.includes(c)) : sorted;
}

// ── Source Switch ─────────────────────────────────
function renderSourceSwitch() {
  const currentSource = getSourcePreference();
  const sourceBtns = document.querySelectorAll('.source-btn');

  sourceBtns.forEach(btn => {
    const source = btn.dataset.source;
    if (source === currentSource) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const footerSource = document.querySelector('.footer-source');
  if (footerSource) {
    const sourceNames = {
      'eltoque': 'El Toque (Informal)',
      'bcc': 'BCC (Oficial)',
      'cadeca': 'CADECA'
    };
    const sourceName = sourceNames[currentSource] || 'El Toque (Informal)';
    // Use DOM instead of innerHTML to avoid security warning
    footerSource.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'footer-dot';
    footerSource.appendChild(dot);
    footerSource.appendChild(document.createTextNode(`TASALO — Tasas de ${sourceName}`));
  }
}

async function handleSourceSwitch(newSource) {
  const currentSource = getSourcePreference();
  if (newSource === currentSource) return;

  settings.sourcePreference = newSource;
  await browser.storage.local.set({ settings });

  await browser.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: { sourcePreference: newSource }
  });

  renderSourceSwitch();
  await loadData();
  renderAll();
}

// ── Grid de tarjetas ──────────────────────────
function renderGrid() {
  const grid = document.getElementById('ratesGrid');
  if (!grid) return;

  const currencies = getSortedCurrencies();
  const showFlags = settings.showCurrencyFlag !== false;
  const fontSize = settings.fontSize ?? 13;
  const isCadeca = getSourcePreference() === 'cadeca';

  const cols = currencies.length <= 2 ? 'cols-2' : '';
  grid.className = 'rates-grid ' + cols;
  grid.textContent = '';

  for (const cur of currencies) {
    const val = currentRates[cur];
    if (val === undefined) continue;
    const change = rateChanges[cur] ?? 'neutral';
    const meta = CURRENCY_META[cur] ?? { name: cur, flag: '💱' };
    const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';

    const card = document.createElement('div');
    card.className = `rate-card ${change}`;

    let valueText, subLabel, diffText, valFontSize;

    if (isCadeca && val && typeof val === 'object') {
      // FIX: CADECA son precios reales de compra y venta, no una tasa
      // única — mostrar el rango en vez de inventar un solo número.
      const buy = val.buy;
      const sell = val.sell;
      if (buy != null && sell != null && buy !== sell) {
        valueText = `${fmtRate(buy)}–${fmtRate(sell)}`;
      } else {
        valueText = fmtRate(sell ?? buy ?? 0);
      }
      subLabel = 'Compra–Venta';
      diffText = arrow;
      valFontSize = fontSize + 1;
      card.title = `${meta.name} · Compra ${buy != null ? fmtRate(buy) : '—'} / Venta ${sell != null ? fmtRate(sell) : '—'} CUP`;
    } else {
      const numVal = typeof val === 'number' ? val : (val && typeof val.rate === 'number' ? val.rate : 0);
      const prev = previousRates[cur];
      const diff = typeof prev === 'number' ? numVal - prev : null;
      valueText = fmtRate(numVal);
      subLabel = meta.name;
      diffText = arrow + (diff !== null && diff !== 0 ? (diff > 0 ? '+' : '') + diff.toFixed(1) : '');
      valFontSize = fontSize + 4;
      card.title = `${meta.name} · ${cur} en pesos cubanos`;
    }

    const top = document.createElement('div');
    top.className = 'rate-top';
    const curSpan = document.createElement('span');
    curSpan.className = 'rate-cur';
    curSpan.textContent = cur;
    top.appendChild(curSpan);
    if (showFlags) {
      const flagSpan = document.createElement('span');
      flagSpan.className = 'rate-flag';
      flagSpan.textContent = meta.flag;
      top.appendChild(flagSpan);
    }

    const valDiv = document.createElement('div');
    valDiv.className = 'rate-val';
    valDiv.style.fontSize = valFontSize + 'px';
    valDiv.textContent = valueText;

    const bot = document.createElement('div');
    bot.className = 'rate-bot';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'rate-name';
    nameSpan.textContent = subLabel;
    const diffSpan = document.createElement('span');
    diffSpan.className = 'rate-diff';
    diffSpan.textContent = diffText;
    bot.appendChild(nameSpan);
    bot.appendChild(diffSpan);

    card.appendChild(top);
    card.appendChild(valDiv);
    card.appendChild(bot);
    grid.appendChild(card);
  }
}

// ── Ticker ────────────────────────────────────
function renderTicker() {
  const strip = document.getElementById('tickerStrip');
  const section = document.getElementById('tickerSection');
  if (!strip) return;

  // Toggle general del ticker (gestión desde Opciones > Ticker)
  if (settings.tickerEnabled === false) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';

  const currencies = settings.tickerCurrencies?.length ? settings.tickerCurrencies : DEFAULT_TICKER_CURRENCIES;

  function makeTickerEmpty(msg) {
    strip.textContent = '';
    const s = document.createElement('span');
    s.style.cssText = 'padding:0 16px;font-size:9px;color:var(--text3);font-family:var(--mono)';
    s.textContent = msg;
    strip.appendChild(s);
  }

  if (Object.keys(binanceRates).length === 0) {
    makeTickerEmpty('Sin datos de Binance');
    return;
  }

  function makeTickerItem(cur, rate) {
    const wrap = document.createElement('span');
    wrap.className = 't-item bnc';
    const curEl = document.createElement('span'); curEl.className = 't-cur'; curEl.textContent = cur;
    const valEl = document.createElement('span'); valEl.className = 't-val'; valEl.textContent = rate.toFixed(2);
    const unitEl = document.createElement('span'); unitEl.className = 't-unit'; unitEl.textContent = 'USDT';
    wrap.appendChild(curEl); wrap.appendChild(valEl); wrap.appendChild(unitEl);
    const sep = document.createElement('span'); sep.className = 'tsep'; sep.textContent = '·';
    return [wrap, sep];
  }

  const filtered = currencies.filter(cur => binanceRates[cur] !== undefined);
  if (!filtered.length) { makeTickerEmpty('Sin datos'); return; }

  strip.textContent = '';
  for (let pass = 0; pass < 2; pass++) {
    for (const cur of filtered) {
      makeTickerItem(cur, binanceRates[cur]).forEach(el => strip.appendChild(el));
    }
  }

  // Duración de la animación, escalada por settings.scrollSpeed
  // (40 = velocidad base/default; mayor valor = ticker más rápido)
  const speed = settings.scrollSpeed || 40;
  const baseDuration = Math.max(15, filtered.length * 0.4);
  const duration = Math.max(6, baseDuration * (40 / speed));
  strip.style.animationDuration = `${duration}s`;
  document.documentElement.style.setProperty('--ticker-dur', `${duration}s`);
}

function applyTickerState() {
  const body = document.getElementById('tickerBody');
  const chevron = document.getElementById('tickerChevron');
  if (body) body.classList.toggle('open', tickerOpen);
  if (chevron) chevron.classList.toggle('open', tickerOpen);
}

// ── Utilidades ────────────────────────────────
function fmtRate(val) {
  if (val >= 10000) return val.toLocaleString('es-CU', { maximumFractionDigits: 0 });
  if (val >= 1000) return val.toLocaleString('es-CU', { maximumFractionDigits: 0 });
  return val.toFixed(val % 1 === 0 ? 0 : 1);
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function applyTheme() {
  const t = settings.colorBg;
  if (t === 'dark') document.body.classList.add('theme-dark');
  if (t === 'light') document.body.classList.add('theme-light');
}

function applyColors() {
  const root = document.documentElement;
  if (settings.colorUp) root.style.setProperty('--up', settings.colorUp);
  if (settings.colorDown) root.style.setProperty('--down', settings.colorDown);
  if (settings.colorNeutral && settings.colorNeutral !== 'auto')
    root.style.setProperty('--neutral', settings.colorNeutral);
}

// ── Listeners ─────────────────────────────────
function attachListeners() {
  // Source Switch
  const sourceSwitch = document.getElementById('sourceSwitch');
  if (sourceSwitch) {
    sourceSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('.source-btn');
      if (btn && btn.dataset.source) {
        handleSourceSwitch(btn.dataset.source);
      }
    });
  }

  const btnRefresh = document.getElementById('btnRefresh');
  const btnSettings = document.getElementById('btnSettings');
  const tickerToggle = document.getElementById('tickerToggle');

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.classList.add('spinning');
      btnRefresh.disabled = true;
      setDot('loading');
      try {
        await browser.runtime.sendMessage({ type: 'FETCH_NOW' });
        const data = await browser.storage.local.get([
          'currentRates', 'rateChanges', 'binanceRates', 'lastUpdated', 'fetchError',
          'eltoqueRates', 'bccRates', 'cadecaRates'
        ]);
        const pref = settings.sourcePreference || 'eltoque';
        currentRates = selectRatesForSource(pref, data);
        rateChanges = data.rateChanges || {};
        binanceRates = data.binanceRates || {};
        renderAll();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        btnRefresh.classList.remove('spinning');
        btnRefresh.disabled = false;
      }
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
    });
  }

  if (tickerToggle) {
    tickerToggle.addEventListener('click', () => {
      tickerOpen = !tickerOpen;
      applyTickerState();
      browser.storage.local.set({ popupUiState: { tickerOpen } });
    });
  }
}

const debouncedStorageUpdate = debounce(async (changes) => {
  if (changes.currentRates || changes.rateChanges || changes.binanceRates || changes.lastUpdated || changes.fetchError ||
      changes.eltoqueRates || changes.bccRates || changes.cadecaRates) {
    await loadData();
    renderAll();
  }
}, 100);

browser.storage.onChanged.addListener((changes) => {
  debouncedStorageUpdate(changes);
});
