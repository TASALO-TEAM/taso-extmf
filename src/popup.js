// ═══════════════════════════════════════════════
//  TASALO — Popup v1
//  Muestra SOLO ElToque O BCC según configuración
// ═══════════════════════════════════════════════

import { PREFERRED_ORDER, CURRENCY_META, browser } from './constants.js';

let settings = {};
let currentRates = {};
let rateChanges = {};
let previousRates = {};
let binanceRates = {};
let tickerOpen = false;
let listenersAttached = false;

// Binance currencies for ticker (top 10 most popular)
const DEFAULT_BINANCE_CURRENCIES = [
  'BTC', 'ETH', 'BNB', 'XRP', 'ADA',
  'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'
];

// ── Debounce utility ───────────────────────────
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
  attachListeners();
});

async function loadData() {
  const data = await browser.storage.local.get([
    'settings', 'currentRates', 'previousRates',
    'rateChanges', 'binanceRates', 'lastUpdated', 'fetchError'
  ]);
  settings = data.settings ?? {};
  currentRates = data.currentRates ?? {};
  previousRates = data.previousRates ?? {};
  rateChanges = data.rateChanges ?? {};
  binanceRates = data.binanceRates ?? {};

  const errorBanner = document.getElementById('errorBanner');
  const errorMsg = document.getElementById('errorMsg');

  if (data.fetchError) {
    setDot('error');
    if (errorBanner) errorBanner.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = data.fetchError;
  } else if (Object.keys(currentRates).length > 0) {
    setDot('ok');
    if (errorBanner) errorBanner.style.display = 'none';
  } else {
    setDot('loading');
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
    renderTicker();
  }

  applyTickerState();
}

// ── Obtener fuente seleccionada (ElToque O BCC) ───────────────────────────
function getSourcePreference() {
  // Por defecto: ElToque
  return settings.sourcePreference || 'eltoque';
}

// ── Obtener monedas de la fuente seleccionada ───────────────────────────
function getSourceCurrencies() {
  const source = getSourcePreference();
  
  // ElToque: mercado informal
  if (source === 'eltoque') {
    return ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT'];
  }
  
  // BCC: mercado oficial
  if (source === 'bcc') {
    return ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'MXN'];
  }
  
  // Default: ElToque
  return ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT'];
}

// ── Ordenar monedas ───────────────────────────
function getSortedCurrencies() {
  const sourceCurrencies = getSourceCurrencies();
  const order = settings.currencyOrder?.length ? settings.currencyOrder : PREFERRED_ORDER;
  const selected = settings.selectedCurrencies ?? [];
  
  // Filtrar solo las monedas de la fuente seleccionada
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

// ── Grid de tarjetas ──────────────────────────
function renderGrid() {
  const grid = document.getElementById('ratesGrid');
  if (!grid) return;

  const currencies = getSortedCurrencies();
  const showFlags = settings.showCurrencyFlag !== false;
  const fontSize = settings.fontSize ?? 13;

  const cols = currencies.length <= 2 ? 'cols-2' : '';
  grid.className = 'rates-grid ' + cols;
  grid.innerHTML = '';

  for (const cur of currencies) {
    const val = currentRates[cur];
    if (val === undefined) continue;
    const change = rateChanges[cur] ?? 'neutral';
    const prev = previousRates[cur];
    const meta = CURRENCY_META[cur] ?? { name: cur, flag: '💱' };
    const diff = prev !== undefined ? val - prev : null;
    const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';

    const card = document.createElement('div');
    card.className = `rate-card ${change}`;
    card.title = `${meta.name} · ${cur} en pesos cubanos`;

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
    valDiv.style.fontSize = (fontSize + 4) + 'px';
    valDiv.textContent = fmtRate(val);

    const bot = document.createElement('div');
    bot.className = 'rate-bot';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'rate-name';
    nameSpan.textContent = meta.name;
    const diffSpan = document.createElement('span');
    diffSpan.className = 'rate-diff';
    diffSpan.textContent = arrow + (diff !== null && diff !== 0 ? (diff > 0 ? '+' : '') + diff.toFixed(1) : '');
    bot.appendChild(nameSpan);
    bot.appendChild(diffSpan);

    card.appendChild(top);
    card.appendChild(valDiv);
    card.appendChild(bot);
    grid.appendChild(card);
  }
}

// ── Ticker de Binance ────────────────────────────────────
function renderTicker() {
  const strip = document.getElementById('tickerStrip');
  if (!strip) return;

  // Usar monedas configuradas o default
  const currencies = settings.tickerCurrencies || DEFAULT_BINANCE_CURRENCIES;

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
  // Duplicate items for seamless loop
  for (let pass = 0; pass < 2; pass++) {
    for (const cur of filtered) {
      makeTickerItem(cur, binanceRates[cur]).forEach(el => strip.appendChild(el));
    }
  }

  // Calculate animation duration
  const duration = Math.max(15, currencies.length * 0.4);
  strip.style.animationDuration = `${duration}s`;
  document.documentElement.style.setProperty('--ticker-dur', `${duration}s`);
}

// ── Toggle ticker ─────────────────────────────
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
        
        // Recargar datos incluyendo binanceRates
        const data = await browser.storage.local.get([
          'currentRates', 'rateChanges', 'binanceRates', 'lastUpdated', 'fetchError'
        ]);
        
        currentRates = data.currentRates || {};
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
  if (changes.currentRates || changes.rateChanges || changes.binanceRates || changes.lastUpdated || changes.fetchError) {
    if (changes.currentRates) currentRates = changes.currentRates.newValue || {};
    if (changes.rateChanges) rateChanges = changes.rateChanges.newValue || {};
    if (changes.binanceRates) binanceRates = changes.binanceRates.newValue || {};
    
    await loadData();
    renderAll();
  }
}, 100);

browser.storage.onChanged.addListener((changes) => {
  debouncedStorageUpdate(changes);
});
