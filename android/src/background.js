// ═══════════════════════════════════════════════
//  TASALO — Background Script (Firefox Android) v0.1.4
//  Sin imports - todo en un archivo
// ═══════════════════════════════════════════════

// Cross-browser API
const browser = globalThis.browser ?? globalThis.chrome;

// Constants inline (sin imports)
const DEFAULT_API_URL = 'http://tasalo.duckdns.org:8040';
const ALARMS = { REFRESH: 'tasalo-refresh', ROTATE: 'tasalo-rotate' };
const PREFERRED_ORDER = ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT', 'CAD', 'GBP', 'CHF', 'RUB', 'AUD', 'JPY', 'MXN', 'BRL', 'COP'];

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
  sourcePreference: 'eltoque',
  newTabEnabled: true,
  tickerCurrencies: ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'],
  showCurrencyFlag: true,
  showTimestamp: true,
  fontSize: 13,
  colorBg: 'auto',
  iconRotateEnabled: true,
  iconRotateInterval: 2,
};

const DEFAULT_BINANCE_CURRENCIES = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'];

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

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════
browser.runtime.onInstalled.addListener(async () => {
  log('Extension installed');
  
  const stored = await browser.storage.local.get('settings');
  if (!stored.settings) {
    await browser.storage.local.set({ settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) });
    log('Settings initialized');
  } else {
    // Cargar settings guardados para que sourcePreference sea correcto
    cachedSettings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...stored.settings };
    log('Settings loaded from storage');
  }
  
  await setupAlarms();
  await fetchRates();
});

browser.runtime.onStartup.addListener(async () => {
  log('Browser started');
  // Cargar settings guardados para que sourcePreference sea correcto
  const stored = await browser.storage.local.get('settings');
  if (stored.settings) {
    cachedSettings = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...stored.settings };
    log(`Settings loaded: sourcePreference=${cachedSettings.sourcePreference}`);
  }
  await setupAlarms();
  await fetchRates();
});

// ═══════════════════════════════════════════════
//  Alarms
// ═══════════════════════════════════════════════
async function setupAlarms() {
  await browser.alarms.clearAll();
  
  const interval = cachedSettings.updateInterval ?? 5;
  
  browser.alarms.create(ALARMS.REFRESH, {
    delayInMinutes: 0.1,
    periodInMinutes: interval,
  });
  
  log(`Alarms set: refresh every ${interval} min`);
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.REFRESH) {
    log('Alarm: refresh');
    await fetchRates();
  }
});

// ═══════════════════════════════════════════════
//  Fetch Rates
// ═══════════════════════════════════════════════
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
    const cadecaRates  = parseSourceRates(data.data.cadeca  || {});
    const binanceRates = extractBinanceRates(data.data.binance);

    // Seleccionar tasas activas según preferencia del usuario
    const sourcePreference = cachedSettings.sourcePreference || 'eltoque';
    const primaryRates = sourcePreference === 'bcc'    ? bccRates
                       : sourcePreference === 'cadeca' ? cadecaRates
                       : eltoqueRates;

    const changes = calculateChanges(primaryRates, cachedRates);
    
    // Update cache
    cachedRates = primaryRates;
    cachedChanges = changes;
    cachedBinanceRates = binanceRates;
    
    // Save to storage (currentRates = fuente preferida, más cada fuente por separado)
    const now = new Date().toISOString();
    await browser.storage.local.set({
      currentRates:  primaryRates,
      eltoqueRates,
      bccRates,
      cadecaRates,
      rateChanges:   changes,
      binanceRates,
      lastUpdated:   now,
      fetchError:    null,
    });
    
    log(`✅ Saved ${Object.keys(primaryRates).length} rates (${sourcePreference}), ${Object.keys(binanceRates).length} binance`);
    
    // Update badge
    updateBadge();
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'ERROR');
    
    await browser.storage.local.set({
      fetchError: error.message,
    });
    
    setBadgeText('ERR', '#dc2626');
  }
}

function extractAllRates(data) {
  const rates = {};
  const sources = ['eltoque', 'cadeca', 'bcc'];
  
  for (const source of sources) {
    if (data[source]) {
      const sourceRates = parseSourceRates(data[source]);
      Object.assign(rates, sourceRates);
    }
  }
  
  return rates;
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

function extractRateValue(item) {
  if (typeof item === 'number') return item;
  if (typeof item === 'string') {
    const n = parseFloat(item.replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  if (typeof item === 'object' && item !== null) {
    // API devuelve {rate, buy, sell, change, prev_rate}
    // Para CADECA: rate = sell_rate (oficial venta)
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

// ═══════════════════════════════════════════════
//  Badge
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
//  Messages
// ═══════════════════════════════════════════════
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
    // Si cambió la fuente, actualizar currentRates en storage desde la fuente correcta
    browser.storage.local.get(['eltoqueRates', 'bccRates', 'cadecaRates']).then(stored => {
      const pref = cachedSettings.sourcePreference || 'eltoque';
      const primaryRates = pref === 'bcc'    ? (stored.bccRates    || {})
                         : pref === 'cadeca' ? (stored.cadecaRates || {})
                         : (stored.eltoqueRates || {});
      if (Object.keys(primaryRates).length > 0) {
        cachedRates = primaryRates;
        const changes = calculateChanges(primaryRates, cachedRates);
        browser.storage.local.set({ currentRates: primaryRates, rateChanges: changes });
      }
    });
    setupAlarms();
    sendResponse({ ok: true });
  }
});

log('Background script loaded (v0.1.3)');
