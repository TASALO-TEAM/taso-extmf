// ═══════════════════════════════════════════════
//  TASALO — Popup Android
//  Sin omnibox, sin newtab, sin options_ui
//  Los ajustes se muestran inline en el popup
// ═══════════════════════════════════════════════

import { PREFERRED_ORDER, CURRENCY_META, browser } from './constants.js';

let settings = {};
let currentRates = {};
let rateChanges = {};
let previousRates = {};
let binanceRates = {};
let tickerOpen = false;
let settingsOpen = false;
let listenersAttached = false;

const DEFAULT_BINANCE_CURRENCIES = [
  'BTC', 'ETH', 'BNB', 'XRP', 'ADA',
  'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'
];

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

function getSourcePreference() {
  return settings.sourcePreference || 'eltoque';
}

function getSourceCurrencies() {
  const source = getSourcePreference();
  if (source === 'eltoque') return ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT'];
  if (source === 'bcc') return ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'MXN'];
  return ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT'];
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

// ── Ticker ────────────────────────────────────
function renderTicker() {
  const strip = document.getElementById('tickerStrip');
  if (!strip) return;

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
  for (let pass = 0; pass < 2; pass++) {
    for (const cur of filtered) {
      makeTickerItem(cur, binanceRates[cur]).forEach(el => strip.appendChild(el));
    }
  }

  const duration = Math.max(15, currencies.length * 0.4);
  strip.style.animationDuration = `${duration}s`;
  document.documentElement.style.setProperty('--ticker-dur', `${duration}s`);
}

function applyTickerState() {
  const body = document.getElementById('tickerBody');
  const chevron = document.getElementById('tickerChevron');
  if (body) body.classList.toggle('open', tickerOpen);
  if (chevron) chevron.classList.toggle('open', tickerOpen);
}

// ── Panel de ajustes inline ───────────────────
function openSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;

  // Cargar valores actuales en los controles
  syncSegment('segSource', settings.sourcePreference || 'eltoque');
  syncSegment('segInterval', String(settings.updateInterval ?? 5));
  syncSegment('segTheme', settings.colorBg || 'auto');

  const toggleFlags = document.getElementById('toggleFlags');
  if (toggleFlags) {
    const on = settings.showCurrencyFlag !== false;
    toggleFlags.dataset.on = String(on);
    toggleFlags.classList.toggle('on', on);
  }

  panel.style.display = 'block';
  settingsOpen = true;
}

function closeSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  if (panel) panel.style.display = 'none';
  settingsOpen = false;
}

function syncSegment(id, activeVal) {
  const seg = document.getElementById(id);
  if (!seg) return;
  seg.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === activeVal);
  });
}

function getSegValue(id) {
  const seg = document.getElementById(id);
  if (!seg) return null;
  const active = seg.querySelector('.seg-btn.active');
  return active ? active.dataset.val : null;
}

// ── Guardar ajustes ───────────────────────────
async function saveSettings() {
  const source = getSegValue('segSource') || 'eltoque';
  const interval = parseInt(getSegValue('segInterval') || '5', 10);
  const theme = getSegValue('segTheme') || 'auto';
  const toggleFlags = document.getElementById('toggleFlags');
  const showFlags = toggleFlags ? toggleFlags.dataset.on === 'true' : true;

  const newSettings = {
    ...settings,
    sourcePreference: source,
    updateInterval: interval,
    colorBg: theme,
    showCurrencyFlag: showFlags,
  };

  await browser.storage.local.set({ settings: newSettings });
  settings = newSettings;

  await browser.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: newSettings });

  applyTheme();
  applyColors();
  renderAll();
  closeSettingsPanel();

  const iv = settings.updateInterval ?? 5;
  const footerInterval = document.getElementById('footerInterval');
  if (footerInterval) {
    footerInterval.textContent =
      `cada ${iv < 60 ? iv + ' min' : (iv / 60).toFixed(1) + ' h'}`;
  }
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
  document.body.classList.remove('theme-dark', 'theme-light');
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
  // Refresh
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.classList.add('spinning');
      btnRefresh.disabled = true;
      setDot('loading');
      try {
        await browser.runtime.sendMessage({ type: 'FETCH_NOW' });
        const data = await browser.storage.local.get([
          'currentRates', 'rateChanges', 'binanceRates', 'lastUpdated', 'fetchError'
        ]);
        currentRates = data.currentRates || {};
        rateChanges = data.rateChanges || {};
        binanceRates = data.binanceRates || {};
        await loadData();
        renderAll();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        btnRefresh.classList.remove('spinning');
        btnRefresh.disabled = false;
      }
    });
  }

  // Settings toggle (abre panel inline en vez de options page)
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      if (settingsOpen) {
        closeSettingsPanel();
      } else {
        openSettingsPanel();
      }
    });
  }

  // Ticker toggle
  const tickerToggle = document.getElementById('tickerToggle');
  if (tickerToggle) {
    tickerToggle.addEventListener('click', () => {
      tickerOpen = !tickerOpen;
      applyTickerState();
      browser.storage.local.set({ popupUiState: { tickerOpen } });
    });
  }

  // Segment buttons (delegated)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    const seg = btn.closest('.settings-seg');
    if (!seg) return;
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Toggle flags
  const toggleFlags = document.getElementById('toggleFlags');
  if (toggleFlags) {
    toggleFlags.addEventListener('click', () => {
      const isOn = toggleFlags.dataset.on === 'true';
      toggleFlags.dataset.on = String(!isOn);
      toggleFlags.classList.toggle('on', !isOn);
    });
  }

  // Save settings
  const btnSave = document.getElementById('btnSaveSettings');
  if (btnSave) {
    btnSave.addEventListener('click', saveSettings);
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
