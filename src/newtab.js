// ═══════════════════════════════════════════════
//  TASALO — New Tab Page
//  Liquid Glass con tres paneles (ElToque + BCC + QvaPay)
//  Con imports ES6 (type="module" en HTML) + Error handling
// ═══════════════════════════════════════════════

import { PREFERRED_ORDER, CURRENCY_META, PRODUCTION_API_URL, DEFAULT_TICKER_CURRENCIES, createFlagNode, browser } from './constants.js';

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
      if (changes.currentRates || changes.rateChanges || changes.eltoqueRates || changes.bccRates || changes.qvapayRates) {
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
      'qvapayRates'
    ]);

    currentRates = data.currentRates || {};
    rateChanges = data.rateChanges || {};
    binanceRates = data.binanceRates || {};

    // Use source-specific rates for each panel
    renderElToquePanel(data.eltoqueRates || {});
    renderBccPanel(data.bccRates || {});
    renderQvapayPanel(data.qvapayRates || {});
    renderBinanceTicker();

  } catch (error) {
    console.error('Error loading rates:', error);
  }
}

// Orden de códigos: primero los conocidos según `order` y después el resto
// (monedas o métodos nuevos que añada la API) por orden alfabético, para que
// todo lo que traiga la fuente se muestre aunque la extensión no lo conozca.
function sortCodes(codes, order) {
  return [...codes].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function setPanelTime(id) {
  const updEl = document.getElementById(id);
  if (updEl) {
    updEl.textContent = new Date().toLocaleTimeString('es-CU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function showPanelEmpty(grid, text) {
  grid.textContent = '';
  const msg = document.createElement('div');
  msg.className = 'pnl-empty';
  msg.textContent = text;
  grid.appendChild(msg);
}

// Panel de una fuente con una tasa por moneda (ElToque, BCC): muestra TODAS
// las monedas que traiga la fuente. "CUP" es la moneda base, no una tarjeta.
function renderCurrencyPanel(gridId, updId, sourceRates, emptyText) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const codes = sortCodes(
    Object.keys(sourceRates).filter(code => code !== 'CUP' && typeof sourceRates[code] === 'number'),
    PREFERRED_ORDER
  );

  grid.textContent = '';

  if (!codes.length) {
    showPanelEmpty(grid, emptyText);
  } else {
    for (const currency of codes) {
      const change = rateChanges[currency] || 'neutral';
      const meta = CURRENCY_META[currency] || { name: currency, flag: '💱' };
      grid.appendChild(createRateCard(currency, sourceRates[currency], change, meta, 'CUP'));
    }
  }

  setPanelTime(updId);
}

function renderElToquePanel(eltoqueRates) {
  renderCurrencyPanel('eltoqueGrid', 'eltoqueUpd', eltoqueRates, 'Sin datos de El Toque por ahora');
}

function renderBccPanel(bccRates) {
  renderCurrencyPanel('bccGrid', 'bccUpd', bccRates, 'Sin datos del BCC por ahora');
}

// ═══════════════════════════════════════════════
//  QvaPay P2P (guardado por background.js desde /tasas/latest → qvapay)
//  Las claves son MÉTODOS DE PAGO, no monedas: cada valor es cuánto de ese
//  método se obtiene por 1 USD de QvaPay. Se muestran TODOS los que traiga
//  la API (los que no tienen operaciones recientes no vienen).
// ═══════════════════════════════════════════════
const QVAPAY_ORDER = ['CUP', 'MLC', 'TROPIPAY', 'ETECSA', 'ZELLE', 'CLASICA', 'BOLSATM', 'BANDECPREPAGO', 'SBERBANK'];
const QVAPAY_META = {
  CUP:           { name: 'Banco CUP',      short: 'CUP',    icon: '🏦' },
  MLC:           { name: 'Banco MLC',      short: 'MLC',    icon: '💳' },
  TROPIPAY:      { name: 'Tropipay',       short: 'TPAY',   icon: '💸' },
  ETECSA:        { name: 'Saldo ETECSA',   short: 'ETECSA', icon: '📱' },
  ZELLE:         { name: 'Zelle',          short: 'ZELLE',  icon: '⚡' },
  CLASICA:       { name: 'Tarjeta Clásica', short: 'CLÁS',  icon: '💳' },
  BOLSATM:       { name: 'Bolsa TM',       short: 'BOLSA',  icon: '👛' },
  BANDECPREPAGO: { name: 'Bandec Prepago', short: 'BPREP',  icon: '💳' },
  SBERBANK:      { name: 'Sberbank',       short: 'SBER',   icon: '🏦' },
};

function renderQvapayPanel(qvapayRates) {
  const grid = document.getElementById('qvapayGrid');
  if (!grid) return;

  const codes = sortCodes(
    Object.keys(qvapayRates).filter(code => qvapayRates[code] && typeof qvapayRates[code].rate === 'number'),
    QVAPAY_ORDER
  );

  grid.textContent = '';

  if (!codes.length) {
    showPanelEmpty(grid, 'Sin datos de QvaPay por ahora');
  } else {
    for (const code of codes) {
      const meta = QVAPAY_META[code] || { name: code, short: code, icon: '💱' };
      grid.appendChild(createQvapayCard(qvapayRates[code], meta));
    }
  }

  setPanelTime('qvapayUpd');
}

// Los valores de QvaPay pueden ser < 10 (Zelle ≈ 1.04, Tropipay ≈ 0.91):
// con formatRate saldrían como "1.0", así que ahí se usan 2 decimales.
function formatQv(value) {
  return value < 10 ? value.toFixed(2) : formatRate(value);
}

function createQvapayCard(info, meta) {
  const change = info.change || 'neutral';
  const card = document.createElement('div');
  card.className = `rcard ${change}`;

  const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';
  const arrowLabel = change === 'up' ? 'Sube' : change === 'down' ? 'Baja' : 'Sin cambio';
  const valueText = formatQv(info.rate);

  const top = document.createElement('div'); top.className = 'rcard-top';
  const sym = document.createElement('span'); sym.className = 'rcard-sym'; sym.textContent = meta.short;
  const ico = document.createElement('span'); ico.className = 'rcard-ico'; ico.textContent = meta.icon;
  ico.setAttribute('aria-hidden', 'true');
  top.appendChild(sym); top.appendChild(ico);

  const val = document.createElement('div');
  val.className = 'rcard-val ' + getSizeClassForLength(valueText.length);
  val.textContent = valueText;

  const unitEl = document.createElement('div'); unitEl.className = 'rcard-unit'; unitEl.textContent = 'por 1 USD';

  card.appendChild(top); card.appendChild(val); card.appendChild(unitEl);

  // Compra / venta: dos trozos que no se parten por dentro; si no caben en la
  // misma línea, la venta baja a la siguiente (mejor que cortar con "…").
  const sides = [];
  if (typeof info.buy === 'number') sides.push(`C ${formatQv(info.buy)}`);
  if (typeof info.sell === 'number') sides.push(`V ${formatQv(info.sell)}`);
  if (sides.length) {
    const bs = document.createElement('div');
    bs.className = 'rcard-bs';
    bs.setAttribute('role', 'group');
    bs.setAttribute('aria-label', 'Compra y venta');
    for (const text of sides) {
      const part = document.createElement('span');
      part.textContent = text;
      bs.appendChild(part);
    }
    card.appendChild(bs);
  }

  card.title = meta.name;

  const bot = document.createElement('div'); bot.className = 'rcard-bot';
  const name = document.createElement('span'); name.className = 'rcard-name'; name.textContent = meta.name;
  const pct = document.createElement('span'); pct.className = 'rcard-pct'; pct.textContent = arrow;
  pct.setAttribute('role', 'img'); pct.setAttribute('aria-label', arrowLabel);
  bot.appendChild(name); bot.appendChild(pct);
  card.appendChild(bot);

  return card;
}

function createRateCard(currency, rate, change, meta, unit) {
  const card = document.createElement('div');
  card.className = `rcard ${change}`;

  const sizeClass = getRateSizeClass(rate);
  const arrow = change === 'up' ? '▲' : change === 'down' ? '▼' : '—';

  const top = document.createElement('div'); top.className = 'rcard-top';
  const sym = document.createElement('span'); sym.className = 'rcard-sym'; sym.textContent = currency;
  const ico = document.createElement('span'); ico.className = 'rcard-ico'; ico.appendChild(createFlagNode(meta.flag, 15));
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
