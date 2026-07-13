// ═════════════════════════════════════════════════
//  TASALO — Background Script (Firefox Desktop)
//  COPIA EXACTA de Android (que funciona) + features desktop
// ═════════════════════════════════════════════════

// Cross-browser API
const browser = globalThis.browser ?? globalThis.chrome;

// Constants inline (sin imports - igual que Android)
const DEFAULT_API_URL = 'https://tasalo.duckdns.org';
const ALARMS = { REFRESH: 'tasalo-refresh', ROTATE: 'tasalo-rotate' };
const PREFERRED_ORDER = ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT', 'CAD', 'GBP', 'CHF', 'RUB', 'AUD', 'JPY', 'MXN', 'BRL', 'COP'];
const DEFAULT_TICKER_CURRENCIES = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'];

const CURRENCY_META = {
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  USD: { name: 'Dólar', symbol: '$', flag: '🇺🇸' },
  MLC: { name: 'MLC', symbol: '₱', flag: '💳' },
  BTC: { name: 'Bitcoin', symbol: '₿', flag: '₿' },
  TRX: { name: 'TRON', symbol: '⚡', flag: '⚡' },
  USDT: { name: 'Tether', symbol: 'T', flag: '💵' },
  CAD: { name: 'Canadiense', symbol: 'C', flag: '🇨🇦' },
  GBP: { name: 'Libra', symbol: '£', flag: '🇬🇧' },
  CHF: { name: 'Franco Suizo', symbol: 'Fr', flag: '🇨🇭' },
  RUB: { name: 'Rublo Ruso', symbol: '₽', flag: '🇷🇺' },
  AUD: { name: 'Australiano', symbol: 'A', flag: '🇦🇺' },
  JPY: { name: 'Yen', symbol: '¥', flag: '🇯🇵' },
  MXN: { name: 'Mexicano', symbol: 'M', flag: '🇲🇽' },
  BRL: { name: 'Real Brasileño', symbol: 'R', flag: '🇧🇷' },
  COP: { name: 'Peso Colombiano', symbol: 'CO', flag: '🇨🇴' }
};

const DEFAULT_SETTINGS = {
  apiUrl: DEFAULT_API_URL,
  updateInterval: 5,
  sourcePreference: 'eltoque', // 'eltoque' | 'bcc' | 'cadeca'
  newTabEnabled: true,
  omniboxEnabled: true,
  tickerEnabled: true,
  tickerCurrencies: [...DEFAULT_TICKER_CURRENCIES],
  scrollSpeed: 40,
  showCurrencyFlag: true,
  showTimestamp: true,
  compactMode: false,
  fontSize: 13,
  colorUp: '#ff6b6b',
  colorDown: '#4ade80',
  colorNeutral: 'auto',
  colorBg: 'auto',
  opacity: 1.0,
  selectedCurrencies: [],
  currencyOrder: [...PREFERRED_ORDER],
  iconRotateEnabled: true,
  iconRotateInterval: 2,
};

// State
let cachedRates = {};
let cachedChanges = {};
let cachedBinanceRates = {};
let cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

// Logging
function log(msg, type = 'INFO') {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${type}] ${msg}`);
}

// ═════════════════════════════════════════════════
//  Init
// ═════════════════════════════════════════════════
browser.runtime.onInstalled.addListener(async () => {
  log('Extension installed');

  const stored = await browser.storage.local.get('settings');
  if (!stored.settings) {
    await browser.storage.local.set({ settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) });
    log('Settings initialized');
  } else {
    cachedSettings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...stored.settings };
    log('Settings loaded from storage');
  }

  await setupAlarms();
  await fetchRates();
});

browser.runtime.onStartup.addListener(async () => {
  log('Browser started');
  const stored = await browser.storage.local.get('settings');
  if (stored.settings) {
    cachedSettings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...stored.settings };
    log(`Settings loaded: sourcePreference=${cachedSettings.sourcePreference}`);
  }
  await setupAlarms();
  await fetchRates();
});

// ═════════════════════════════════════════════════
//  Alarms
// ═════════════════════════════════════════════════
async function setupAlarms() {
  await browser.alarms.clearAll();

  const interval = cachedSettings.updateInterval ?? 5;

  browser.alarms.create(ALARMS.REFRESH, {
    delayInMinutes: 0.1,
    periodInMinutes: interval,
  });

  browser.alarms.create(ALARMS.ROTATE, {
    delayInMinutes: 10,
    periodInMinutes: 10,
  });

  log(`Alarms set: refresh every ${interval} min, rotate every 10 min`);
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.REFRESH) {
    log('Alarm: refresh');
    // FIX (paridad Chromium): recargar settings desde storage antes de
    // fetchear — en un event page/service worker no persistente, la
    // variable en memoria puede quedar desactualizada entre despertares.
    const stored = await browser.storage.local.get('settings');
    if (stored.settings) {
      cachedSettings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...stored.settings };
    }
    await fetchRates();
  }

  if (alarm.name === ALARMS.ROTATE) {
    await updateBadge();
  }
});

// ═════════════════════════════════════════════════
//  Fetch Rates
// ═════════════════════════════════════════════════
async function fetchRates() {
  try {
    const apiUrl = cachedSettings.apiUrl || DEFAULT_API_URL;
    log(`Fetching from ${apiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(`${apiUrl}/api/v1/tasas/latest`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal,
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado (10s)');
      }
      throw new Error(`Sin conexión: ${netErr.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log(`Response: ok=${data.ok}`);

    if (!data.ok || !data.data) {
      throw new Error('Invalid API response');
    }

    // Extract rates per source (sin mezclar, cada fuente por separado)
    const eltoqueRates = parseSourceRates(data.data.eltoque || {});
    const bccRates     = parseSourceRates(data.data.bcc     || {});
    // FIX: CADECA no trae un campo "rate" en la API (solo buy/sell), son
    // precios reales de compra y venta — se preservan ambos en vez de
    // aplastarlos a un solo número (antes se perdía esta información).
    const cadecaRates  = parseCadecaRates(data.data.cadeca  || {});
    const binanceRates = extractBinanceRates(data.data.binance);

    // Vista plana de CADECA (solo números) para badge/omnibox/cálculo de cambios
    const cadecaFlat = {};
    for (const [cur, info] of Object.entries(cadecaRates)) {
      cadecaFlat[cur] = info.rate;
    }

    // Seleccionar tasas activas según preferencia del usuario
    const sourcePreference = cachedSettings.sourcePreference || 'eltoque';
    const primaryRatesFlat = sourcePreference === 'bcc'    ? bccRates
                           : sourcePreference === 'cadeca' ? cadecaFlat
                           : eltoqueRates;

    const changes = calculateChanges(primaryRatesFlat, cachedRates);

    // Update cache (siempre números planos, para badge/omnibox)
    cachedRates = primaryRatesFlat;
    cachedChanges = changes;
    cachedBinanceRates = binanceRates;

    // Save to storage (currentRates = fuente preferida, más cada fuente por separado;
    // cadecaRates guarda los objetos ricos {buy,sell,rate,change} para el popup)
    const now = new Date().toISOString();
    await browser.storage.local.set({
      currentRates:  primaryRatesFlat,
      eltoqueRates,
      bccRates,
      cadecaRates,
      rateChanges:   changes,
      binanceRates,
      lastUpdated:   now,
      fetchError:    null,
    });

    log(`✅ Saved ${Object.keys(primaryRatesFlat).length} rates (${sourcePreference}), ${Object.keys(binanceRates).length} binance`);

    // Update badge
    updateBadge();

    // Frase del año + tasas de combustible: complementarios, no bloquean
    // ni rompen el fetch principal si fallan.
    await Promise.allSettled([fetchYearState(), fetchFuelRates()]);

    // Broadcast to tabs
    broadcastToTabs({
      type: 'RATES_UPDATED',
      rates: primaryRatesFlat,
      changes,
      binanceRates,
      lastUpdated: now,
    });

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'ERROR');

    await browser.storage.local.set({
      fetchError: error.message,
    });

    setBadgeText('ERR', '#dc2626');
  }
}

// Frase del día / progreso del año (GET /api/v1/year/state)
async function fetchYearState() {
  try {
    const apiUrl = cachedSettings.apiUrl || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/api/v1/year/state`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data && data.ok) {
      await browser.storage.local.set({ yearState: data, yearStateUpdated: new Date().toISOString() });
    }
  } catch (error) {
    log(`Year state fetch error: ${error.message}`, 'WARN');
  }
}

// Tasas de combustible, rango de precios (GET /api/v1/tasas/fuel)
async function fetchFuelRates() {
  try {
    const apiUrl = cachedSettings.apiUrl || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/api/v1/tasas/fuel`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data && data.rates) {
      await browser.storage.local.set({ fuelRates: data, fuelRatesUpdated: new Date().toISOString() });
    }
  } catch (error) {
    log(`Fuel rates fetch error: ${error.message}`, 'WARN');
  }
}

function extractBinanceRates(binanceData) {
  if (!binanceData || typeof binanceData !== 'object') {
    return {};
  }

  const rates = {};
  for (const [currency, value] of Object.entries(binanceData)) {
    const rate = extractRateValue(value);
    if (rate !== null) {
      rates[currency] = rate;
    }
  }
  return rates;
}

function parseSourceRates(sourceData) {
  const rates = {};

  if (Array.isArray(sourceData)) {
    for (const item of sourceData) {
      const currency = (item.currency || item.code || '').toUpperCase();
      const rate = extractRateValue(item);
      if (currency && rate !== null) {
        rates[currency] = rate;
      }
    }
  } else if (typeof sourceData === 'object') {
    for (const [key, value] of Object.entries(sourceData)) {
      const currency = key.toUpperCase();
      const rate = extractRateValue(value);
      if (currency && rate !== null) {
        rates[currency] = rate;
      }
    }
  }

  return rates;
}

// CADECA: la API devuelve {buy, sell, change, prev_rate} por moneda (SIN
// campo "rate"), porque son precios de compra y venta reales, no una
// tasa única. Se preservan ambos valores para mostrarlos fielmente.
function parseCadecaRates(sourceData) {
  const rates = {};
  if (!sourceData || typeof sourceData !== 'object') return rates;

  for (const [key, value] of Object.entries(sourceData)) {
    if (!value || typeof value !== 'object') continue;

    const buy  = typeof value.buy === 'number' ? value.buy : (value.buy != null ? parseFloat(value.buy) : null);
    const sell = typeof value.sell === 'number' ? value.sell : (value.sell != null ? parseFloat(value.sell) : null);

    if (buy === null && sell === null) continue;

    rates[key.toUpperCase()] = {
      buy,
      sell,
      rate: sell ?? buy,
      change: value.change || 'neutral',
    };
  }

  return rates;
}

function extractRateValue(item) {
  if (typeof item === 'number') return item;
  if (typeof item === 'string') {
    const n = parseFloat(item.replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  if (typeof item === 'object' && item !== null) {
    const val = item.rate ?? item.sell ?? item.price ?? item.value ?? item.tasa;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const n = parseFloat(val.replace(',', '.'));
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

function calculateChanges(current, previous) {
  const changes = {};
  for (const [currency, rate] of Object.entries(current)) {
    const prev = previous[currency];
    if (prev === undefined) {
      changes[currency] = 'new';
    } else if (rate > prev) {
      changes[currency] = 'up';
    } else if (rate < prev) {
      changes[currency] = 'down';
    } else {
      changes[currency] = 'neutral';
    }
  }
  return changes;
}

// ═════════════════════════════════════════════════
//  Badge
// ═════════════════════════════════════════════════
function updateBadge() {
  const currency = 'USD';
  const rate = cachedRates[currency];

  if (rate !== undefined) {
    const text = formatBadgeValue(rate);
    const change = cachedChanges[currency];
    const color = getBadgeColor(change);
    setBadgeText(text, color);
  }
}

function formatBadgeValue(rate) {
  if (rate >= 1000) return String(Math.round(rate));
  return rate % 1 === 0 ? String(rate) : rate.toFixed(1);
}

function getBadgeColor(change) {
  switch (change) {
    case 'up': return '#ff6b6b';
    case 'down': return '#4ade80';
    default: return '#1e1e38';
  }
}

function setBadgeText(text, bgColor) {
  try {
    browser.action.setBadgeText({ text });
    browser.action.setBadgeBackgroundColor({ color: bgColor });
  } catch (e) {
    log(`Badge error: ${e.message}`, 'WARN');
  }
}

// ═════════════════════════════════════════════════
//  Messages
// ═════════════════════════════════════════════════
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_NOW') {
    fetchRates().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_RATES') {
    sendResponse({
      rates: cachedRates,
      changes: cachedChanges,
      binanceRates: cachedBinanceRates,
      settings: cachedSettings,
    });
  }

  if (msg.type === 'RESET_SETTINGS') {
    browser.storage.local.set({ settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) })
      .then(async () => {
        cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        await setupAlarms();
        sendResponse({ ok: true });
      });
    return true;
  }

  if (msg.type === 'UPDATE_SETTINGS') {
    cachedSettings = { ...cachedSettings, ...msg.settings };
    browser.storage.local.get(['eltoqueRates', 'bccRates', 'cadecaRates']).then(stored => {
      const pref = cachedSettings.sourcePreference || 'eltoque';
      let primaryRatesFlat;
      if (pref === 'bcc') {
        primaryRatesFlat = stored.bccRates || {};
      } else if (pref === 'cadeca') {
        primaryRatesFlat = {};
        for (const [cur, info] of Object.entries(stored.cadecaRates || {})) {
          primaryRatesFlat[cur] = (info && typeof info === 'object') ? info.rate : info;
        }
      } else {
        primaryRatesFlat = stored.eltoqueRates || {};
      }
      if (Object.keys(primaryRatesFlat).length > 0) {
        const changes = calculateChanges(primaryRatesFlat, cachedRates);
        cachedRates = primaryRatesFlat;
        cachedChanges = changes;
        browser.storage.local.set({ currentRates: primaryRatesFlat, rateChanges: changes });
        updateBadge();
      }
    });
    setupAlarms();
    sendResponse({ ok: true });
  }
});

// ═════════════════════════════════════════════════
//  Omnibox (desktop only - con guards)
// ═════════════════════════════════════════════════
if (browser.omnibox) {
  browser.omnibox.onInputStarted.addListener(() => {
    if (cachedSettings.omniboxEnabled === false) {
      browser.omnibox.setDefaultSuggestion({
        description: 'TASALO — búsqueda desde la barra desactivada (actívala en Opciones)'
      });
      return;
    }
    browser.omnibox.setDefaultSuggestion({
      description: 'TASALO — escribe una moneda (USD, EUR, BTC...) o Enter para ver todo'
    });
  });

  browser.omnibox.onInputChanged.addListener((text, suggest) => {
    if (cachedSettings.omniboxEnabled === false) {
      suggest([]);
      return;
    }
    const query = text.trim().toUpperCase();
    const suggestions = [];
    const currencies = Object.keys(cachedRates);

    for (const currency of currencies) {
      const rate = cachedRates[currency];
      if (!rate) continue;
      const change = cachedChanges[currency] || 'neutral';
      const arrow  = change === 'up' ? '↑' : change === 'down' ? '↓' : '-';
      const meta   = CURRENCY_META[currency] || { name: currency };
      const price  = formatBadgeValue(rate);

      if (query && !currency.startsWith(query) && !meta.name.toUpperCase().includes(query)) continue;

      const label = change === 'up' ? 'subió' : change === 'down' ? 'bajó' : 'estable';
      suggestions.push({
        content: currency,
        description: `${currency} ${arrow} ${price} CUP — ${meta.name} (${label})`
      });
    }

    if (suggestions.length === 0 && query) {
      suggestions.push({ content: '', description: `No encontrado: "${text}" — prueba EUR, USD, MLC, BTC` });
    }

    suggest(suggestions);
  });

  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    if (cachedSettings.newTabEnabled === false) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(text ? `tasalo ${text}` : 'tasalo')}`;
      disposition === 'currentTab' ? browser.tabs.update({ url }) : browser.tabs.create({ url });
      return;
    }
    const url = browser.runtime.getURL('src/newtab.html') + (text ? `#${text.toUpperCase()}` : '');
    disposition === 'currentTab' ? browser.tabs.update({ url }) : browser.tabs.create({ url });
  });
}

// ═════════════════════════════════════════════════
//  Utilities
// ═════════════════════════════════════════════════
function broadcastToTabs(message) {
  browser.tabs.query({}).then(tabs => {
    for (const tab of tabs) {
      if (tab.id && tab.url &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('moz-extension://') &&
          !tab.url.startsWith('about:')) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  }).catch(() => {});
}

try {
  log(`Background script loaded (v${browser.runtime.getManifest().version})`);
} catch {
  log('Background script loaded');
}
