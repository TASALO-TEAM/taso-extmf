// ═══════════════════════════════════════════════
//  TASALO — New Tab Page
//  Liquid Glass con tres paneles (ElToque + BCC + Combustible)
//  Con imports ES6 (type="module" en HTML) + Error handling
// ═══════════════════════════════════════════════

import { PREFERRED_ORDER, CURRENCY_META, PRODUCTION_API_URL, DEFAULT_TICKER_CURRENCIES, browser } from './constants.js';

// Estado global
let currentRates = {};
let rateChanges = {};
let binanceRates = {};
let settings = {};

// ═══════════════════════════════════════════════
//  Init - CON MANEJO DE ERRORES ROBUSTO
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('[NewTab] DOMContentLoaded - starting init');

    await loadSettings();
    console.log('[NewTab] Settings loaded:', settings);

    setupTheme();
    console.log('[NewTab] Theme setup done');

    setupClock();
    console.log('[NewTab] Clock setup done');

    await setupYearProgress();
    console.log('[NewTab] Year progress setup done');

    setFooterVersion();
    console.log('[NewTab] Footer version set');

    await loadRates();
    console.log('[NewTab] Rates loaded');

    setupRefresh();
    console.log('[NewTab] Refresh setup done');

    // Escuchar cambios en storage
    browser.storage.onChanged.addListener((changes) => {
      console.log('[NewTab] Storage changed:', Object.keys(changes));
      if (changes.currentRates || changes.rateChanges || changes.eltoqueRates || changes.bccRates || changes.fuelRates) {
        loadRates();
      }
      if (changes.yearState) {
        setupYearProgress();
      }
      if (changes.settings) {
        settings = changes.settings.newValue || {};
        renderBinanceTicker();
      }
    });

    console.log('[NewTab] ✅ Initialization complete');
  } catch (error) {
    console.error('[NewTab] ❌ Initialization error:', error);
    console.error('[NewTab] Stack:', error.stack);
  }
});

async function loadSettings() {
  const data = await browser.storage.local.get('settings');
  settings = data.settings || {};
}

function setFooterVersion() {
  const el = document.getElementById('footVersion');
  if (!el) return;
  try {
    el.textContent = 'v' + browser.runtime.getManifest().version;
  } catch {
    el.textContent = '';
  }
}

function setupTheme() {
  try {
    const theme = settings.colorBg || 'auto';
    applyTheme(theme);

    // Theme toggle buttons
    const themeBtns = document.querySelectorAll('.theme-btn');
    if (!themeBtns || themeBtns.length === 0) {
      console.warn('[NewTab] No theme buttons found');
      return;
    }

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyTheme(btn.dataset.theme);

        // Guardar preferencia
        settings.colorBg = btn.dataset.theme;
        browser.storage.local.set({ settings });
      });
    });
  } catch (error) {
    console.error('[NewTab] Error in setupTheme:', error);
  }
}

function applyTheme(theme) {
  try {
    // FIX: antes, para 'dark' se añadía la clase 'light' y en la línea
    // siguiente se quitaba — era un no-op, el botón "Dark" no hacía nada.
    if (theme === 'dark') {
      document.documentElement.classList.remove('light');
    } else if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      // Auto - usar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
      }
    }
  } catch (error) {
    console.error('[NewTab] Error in applyTheme:', error);
  }
}

// ═══════════════════════════════════════════════
//  Clock
// ═══════════════════════════════════════════════
function setupClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const clock = document.getElementById('clock');
  const dateStr = document.getElementById('dateStr');

  if (clock) {
    clock.textContent = now.toLocaleTimeString('es-CU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  if (dateStr) {
    dateStr.textContent = now.toLocaleDateString('es-CU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// ═══════════════════════════════════════════════
//  Year Progress + Frase del día (usa GET /api/v1/year/state
//  cacheado por background.js; si no hay datos o falla, cae al
//  cálculo local, sin frase).
// ═══════════════════════════════════════════════
async function setupYearProgress() {
  try {
    const now = new Date();
    const year = now.getFullYear();

    // Días transcurridos: siempre se calcula localmente (es determinista).
    // percent y daysRemaining vienen de la API cuando está disponible,
    // para que coincidan exactamente con /y del bot.
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const totalMs = yearEnd - yearStart;
    const elapsedMs = now - yearStart;
    const daysPassed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

    let percent = (elapsedMs / totalMs) * 100;
    let daysRemaining = 365 - daysPassed;
    let quoteText = null;

    try {
      const data = await browser.storage.local.get('yearState');
      const state = data.yearState;
      if (state && state.ok && state.progress) {
        if (typeof state.progress.percent === 'number') percent = state.progress.percent;
        if (typeof state.progress.days_left === 'number') daysRemaining = state.progress.days_left;
        if (state.quote && state.quote.quote) quoteText = state.quote.quote;
      }
    } catch {
      // sin storage disponible — nos quedamos con el cálculo local
    }

    const weeksLeft = Math.ceil(daysRemaining / 7);

    // Update UI
    const progressEl = document.getElementById('yearProgress');
    const pctEl = document.getElementById('ywPct');
    const daysPassedEl = document.getElementById('daysPassed');
    const daysRemainingEl = document.getElementById('daysRemaining');
    const weeksLeftEl = document.getElementById('weeksLeft');
    const mticks = document.querySelectorAll('.mtick');

    if (progressEl) {
      setTimeout(() => {
        progressEl.style.width = `${percent.toFixed(1)}%`;
      }, 100);
    }

    if (pctEl) {
      pctEl.textContent = '';
      pctEl.appendChild(document.createTextNode(percent.toFixed(1) + '% '));
      const smallEl = document.createElement('small');
      smallEl.textContent = 'completado';
      pctEl.appendChild(smallEl);
    }

    if (daysPassedEl) daysPassedEl.textContent = daysPassed;
    if (daysRemainingEl) daysRemainingEl.textContent = daysRemaining;
    if (weeksLeftEl) weeksLeftEl.textContent = weeksLeft;

    // Highlight current month
    const currentMonth = now.getMonth();

    mticks.forEach((tick, index) => {
      tick.classList.remove('past', 'now');
      if (index < currentMonth) {
        tick.classList.add('past');
      } else if (index === currentMonth) {
        tick.classList.add('now');
      }
    });

    // Frase del día
    const quoteBlock = document.getElementById('ywQuote');
    const quoteTextEl = document.getElementById('ywQuoteText');
    if (quoteBlock && quoteTextEl) {
      if (quoteText) {
        quoteTextEl.textContent = quoteText;
        quoteBlock.style.display = 'flex';
      } else {
        quoteBlock.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('[NewTab] Error in setupYearProgress:', error);
  }
}

// ═══════════════════════════════════════════════
//  Load Rates
// ═══════════════════════════════════════════════
async function loadRates() {
  try {
    const data = await browser.storage.local.get([
      'currentRates',
      'rateChanges',
      'binanceRates',
      'lastUpdated',
      'eltoqueRates',
      'bccRates',
      'cadecaRates',
      'fuelRates'
    ]);

    currentRates = data.currentRates || {};
    rateChanges = data.rateChanges || {};
    binanceRates = data.binanceRates || {};

    // Use source-specific rates for each panel
    const eltoqueRates = data.eltoqueRates || {};
    const bccRates = data.bccRates || {};

    renderElToquePanel(eltoqueRates);
    renderBccPanel(bccRates);
    renderFuelPanel(data.fuelRates || null);
    renderBinanceTicker();

  } catch (error) {
    console.error('Error loading rates:', error);
  }
}

function renderElToquePanel(eltoqueRates) {
  const grid = document.getElementById('eltoqueGrid');
  if (!grid) return;

  // ElToque currencies (informal market)
  const eltoqueCurrencies = ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT'];

  grid.textContent = '';

  for (const currency of eltoqueCurrencies) {
    const rate = eltoqueRates[currency];
    if (rate === undefined) continue;

    const change = rateChanges[currency] || 'neutral';
    const meta = CURRENCY_META[currency] || { name: currency, flag: '💱' };

    const card = createRateCard(currency, rate, change, meta, 'CUP');
    grid.appendChild(card);
  }

  // Update timestamp
  const updEl = document.getElementById('eltoqueUpd');
  if (updEl) {
    updEl.textContent = new Date().toLocaleTimeString('es-CU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function renderBccPanel(bccRates) {
  const grid = document.getElementById('bccGrid');
  if (!grid) return;

  // BCC currencies (official market)
  const bccCurrencies = ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'MXN'];

  grid.textContent = '';

  for (const currency of bccCurrencies) {
    const rate = bccRates[currency];
    if (rate === undefined) continue;

    const change = rateChanges[currency] || 'neutral';
    const meta = CURRENCY_META[currency] || { name: currency, flag: '💱' };

    const card = createRateCard(currency, rate, change, meta, 'CUP');
    grid.appendChild(card);
  }

  // Update timestamp
  const updEl = document.getElementById('bccUpd');
  if (updEl) {
    updEl.textContent = new Date().toLocaleTimeString('es-CU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Combustible (GET /api/v1/tasas/fuel, cacheado por background.js).
// Se cotiza como un RANGO de precios (mínimo-máximo), no como una tasa
// única — se muestra tal cual para ser fiel a la realidad.
const FUEL_META = {
  'B-94':     { name: 'Gasolina B-94', flag: '⛽', short: 'B94' },
  'B-90':     { name: 'Gasolina B-90', flag: '⛽', short: 'B90' },
  'B-83':     { name: 'Gasolina B-83', flag: '⛽', short: 'B83' },
  'Petroleo': { name: 'Petróleo/Diésel', flag: '🛢️', short: 'GO' },
  'Gas_LP':   { name: 'Gas Licuado (LP)', flag: '🔥', short: 'GLP' },
};
const FUEL_ORDER = ['B-94', 'B-90', 'B-83', 'Petroleo', 'Gas_LP'];

function renderFuelPanel(fuelData) {
  const grid = document.getElementById('fuelGrid');
  if (!grid) return;

  const rates = (fuelData && fuelData.rates) || {};
  grid.textContent = '';

  for (const key of FUEL_ORDER) {
    const item = rates[key];
    if (!item) continue;

    const buy = typeof item.buy === 'number' ? item.buy : null;
    const sell = typeof item.sell === 'number' ? item.sell : null;
    if (buy === null && sell === null) continue;

    const meta = FUEL_META[key] || { name: key, flag: '⛽', short: key };
    const change = item.change || 'neutral';
    const unit = item.unit || 'CUP/L';

    const card = createFuelCard(meta.short, buy, sell, change, meta, unit);
    grid.appendChild(card);
  }

  if (!grid.children.length) {
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'skel';
      skel.style.height = '80px';
      grid.appendChild(skel);
    }
  }

  const updEl = document.getElementById('fuelUpd');
  if (updEl) {
    updEl.textContent = new Date().toLocaleTimeString('es-CU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function createFuelCard(label, buy, sell, change, meta, unit) {
  const card = document.createElement('div');
  card.className = `rcard ${change}`;

  const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';

  let valueText;
  if (buy != null && sell != null && buy !== sell) {
    valueText = `${formatRate(buy)}–${formatRate(sell)}`;
  } else {
    valueText = formatRate(sell ?? buy);
  }

  const sizeClass = getSizeClassForLength(valueText.length);

  const top = document.createElement('div'); top.className = 'rcard-top';
  const sym = document.createElement('span'); sym.className = 'rcard-sym'; sym.textContent = label;
  const ico = document.createElement('span'); ico.className = 'rcard-ico'; ico.textContent = meta.flag;
  top.appendChild(sym); top.appendChild(ico);

  const val = document.createElement('div'); val.className = 'rcard-val ' + sizeClass; val.textContent = valueText;
  const unitEl = document.createElement('div'); unitEl.className = 'rcard-unit'; unitEl.textContent = unit;

  const bot = document.createElement('div'); bot.className = 'rcard-bot';
  const name = document.createElement('span'); name.className = 'rcard-name'; name.textContent = meta.name;
  const pct = document.createElement('span'); pct.className = 'rcard-pct'; pct.textContent = arrow;
  bot.appendChild(name); bot.appendChild(pct);

  card.appendChild(top); card.appendChild(val); card.appendChild(unitEl); card.appendChild(bot);

  return card;
}

function createRateCard(currency, rate, change, meta, unit) {
  const card = document.createElement('div');
  card.className = `rcard ${change}`;

  const sizeClass = getRateSizeClass(rate);
  const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';

  const top = document.createElement('div'); top.className = 'rcard-top';
  const sym = document.createElement('span'); sym.className = 'rcard-sym'; sym.textContent = currency;
  const ico = document.createElement('span'); ico.className = 'rcard-ico'; ico.textContent = meta.flag;
  top.appendChild(sym); top.appendChild(ico);

  const val = document.createElement('div'); val.className = 'rcard-val ' + sizeClass; val.textContent = formatRate(rate);
  const unitEl = document.createElement('div'); unitEl.className = 'rcard-unit'; unitEl.textContent = unit;

  const bot = document.createElement('div'); bot.className = 'rcard-bot';
  const name = document.createElement('span'); name.className = 'rcard-name'; name.textContent = meta.name;
  const pct = document.createElement('span'); pct.className = 'rcard-pct'; pct.textContent = arrow;
  bot.appendChild(name); bot.appendChild(pct);

  card.appendChild(top); card.appendChild(val); card.appendChild(unitEl); card.appendChild(bot);

  return card;
}

function getRateSizeClass(rate) {
  const len = formatRate(rate).length;
  return getSizeClassForLength(len);
}

// Umbrales poco agresivos para que un rango tipo "380–420" mantenga el
// mismo tamaño que una tasa normal (hay espacio de sobra en la tarjeta).
function getSizeClassForLength(len) {
  if (len >= 13) return 'sz7';
  if (len >= 11) return 'sz6';
  if (len >= 9) return 'sz5';
  return 'sz4';
}

function formatRate(rate) {
  if (rate >= 1000000) return (rate / 1000000).toFixed(1) + 'M';
  if (rate >= 100000) return Math.round(rate / 1000) + 'k';
  if (rate >= 10000) return (rate / 1000).toFixed(1) + 'k';
  if (rate >= 1000) return String(Math.round(rate));
  return rate % 1 === 0 ? String(rate) : rate.toFixed(1);
}

function renderBinanceTicker() {
  const strip = document.getElementById('tickerStrip');
  const zone = document.getElementById('tickerZone');
  if (!strip) return;

  // Toggle general del ticker (gestión desde Opciones > Ticker)
  if (settings.tickerEnabled === false) {
    if (zone) zone.style.display = 'none';
    return;
  }
  if (zone) zone.style.display = '';

  const selected = settings.tickerCurrencies?.length ? settings.tickerCurrencies : DEFAULT_TICKER_CURRENCIES;
  const currencies = selected.filter(cur => binanceRates[cur] !== undefined);
  if (currencies.length === 0) return;

  function makeItem(cur, rate) {
    const wrap = document.createElement('span'); wrap.className = 'ti bnc';
    const src = document.createElement('span'); src.className = 'tsrc'; src.textContent = 'Binance';
    const curEl = document.createElement('span'); curEl.className = 'tcur'; curEl.textContent = cur;
    const valEl = document.createElement('span'); valEl.className = 'tval'; valEl.textContent = rate.toFixed(2);
    const unitEl = document.createElement('span'); unitEl.className = 'tunit'; unitEl.textContent = 'USDT';
    wrap.appendChild(src); wrap.appendChild(curEl); wrap.appendChild(valEl); wrap.appendChild(unitEl);
    const sep = document.createElement('span'); sep.className = 'tsep'; sep.textContent = '·';
    return [wrap, sep];
  }

  // Duplicate for seamless loop, built entirely with DOM (no innerHTML)
  strip.textContent = '';
  for (let pass = 0; pass < 2; pass++) {
    for (const cur of currencies) {
      makeItem(cur, binanceRates[cur]).forEach(el => strip.appendChild(el));
    }
  }

  // Duración de la animación, escalada por settings.scrollSpeed
  const speed = settings.scrollSpeed || 40;
  const totalChars = currencies.length * 20;
  const baseDuration = Math.max(20, totalChars * 0.5);
  const duration = Math.max(8, baseDuration * (40 / speed));
  strip.style.animationDuration = `${duration}s`;
  document.documentElement.style.setProperty('--td', `${duration}s`);
}

// ═══════════════════════════════════════════════
//  Refresh
// ═══════════════════════════════════════════════
function setupRefresh() {
  const refreshLink = document.getElementById('refreshLink');
  const btnSettings = document.getElementById('btnSettings');

  if (refreshLink) {
    refreshLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await browser.runtime.sendMessage({ type: 'FETCH_NOW' });
      await loadRates();
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
    });
  }
}
