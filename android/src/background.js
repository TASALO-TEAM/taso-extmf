// ═══════════════════════════════════════════════
//  TASALO — Background Script (Firefox Android)
//  Sin imports - todo en un archivo (event page)
// ═══════════════════════════════════════════════

// Cross-browser API
const browser = globalThis.browser ?? globalThis.chrome;

// Constants inline (sin imports)
// Firefox MV3 aplica `upgrade-insecure-requests` por defecto: http:// se
// reescribe a https://. La API de producción vive detrás de Caddy en 443.
const DEFAULT_API_URL = 'https://tasalo.duckdns.org';
const LEGACY_API_URL_RE = /^http:\/\/tasalo\.duckdns\.org(:\d+)?\/?$/i;
const ALARMS = { REFRESH: 'tasalo-refresh', ROTATE: 'tasalo-rotate' };
const PREFERRED_ORDER = ['EUR', 'USD', 'MLC', 'BTC', 'TRX', 'USDT', 'CAD', 'GBP', 'CHF', 'RUB', 'AUD', 'JPY', 'MXN', 'BRL', 'COP'];
const DEFAULT_TICKER_CURRENCIES = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'TRX', 'DOT', 'MATIC'];

const DEFAULT_SETTINGS = {
  apiUrl: DEFAULT_API_URL,
  updateInterval: 5,
  sourcePreference: 'eltoque', // 'eltoque' | 'bcc' | 'cadeca'
  newTabEnabled: true,
  tickerEnabled: true,
  tickerCurrencies: [...DEFAULT_TICKER_CURRENCIES],
  scrollSpeed: 40,
  showCurrencyFlag: true,
  showTimestamp: true,
  fontSize: 13,
  colorBg: 'auto',
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

// ═══════════════════════════════════════════════
//  Settings
//  Firefox Android suspende el event page con frecuencia: al despertar,
//  las variables en memoria vuelven a sus valores por defecto. Por eso los
//  settings se recargan desde storage al cargar el script y antes de cada
//  operación que dependa de ellos.
// ═══════════════════════════════════════════════
async function loadSettings() {
  try {
    const stored = await browser.storage.local.get('settings');
    const merged = { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...(stored.settings || {}) };

    // Migración: instalaciones previas guardaron apiUrl con http:// (y/o :8040).
    // Firefox lo reescribe a https://…:8040 (sin TLS) y el fetch falla siempre.
    let migrated = false;
    if (typeof merged.apiUrl !== 'string' || !merged.apiUrl || LEGACY_API_URL_RE.test(merged.apiUrl)) {
      log(`Migrando apiUrl obsoleta (${merged.apiUrl}) → ${DEFAULT_API_URL}`, 'WARN');
      merged.apiUrl = DEFAULT_API_URL;
      migrated = true;
    }

    cachedSettings = merged;
    if (migrated || !stored.settings) {
      await browser.storage.local.set({ settings: merged });
    }
  } catch (e) {
    log(`loadSettings error: ${e.message}`, 'WARN');
  }
  return cachedSettings;
}

// Se ejecuta cada vez que el event page despierta
let ready = loadSettings();

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════
browser.runtime.onInstalled.addListener(async () => {
  log('Extension installed/updated');
  await loadSettings();
  await setupAlarms();
  await fetchRates();
});

browser.runtime.onStartup.addListener(async () => {
  log('Browser started');
  await loadSettings();
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
    await loadSettings();
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
    // CADECA no trae "rate": son precios reales de compra y venta. Se
    // preservan ambos ({buy, sell, rate, change}) para mostrarlos fielmente.
    const cadecaRates  = parseCadecaRates(data.data.cadeca  || {});
    const binanceRates = extractBinanceRates(data.data.binance);

    // Vista plana de CADECA (solo números) para badge y cálculo de cambios
    const cadecaFlat = {};
    for (const [cur, info] of Object.entries(cadecaRates)) {
      cadecaFlat[cur] = info.rate;
    }

    const sourcePreference = cachedSettings.sourcePreference || 'eltoque';
    const primaryRatesFlat = sourcePreference === 'bcc'    ? bccRates
                           : sourcePreference === 'cadeca' ? cadecaFlat
                           : eltoqueRates;

    // Tras una suspensión cachedRates está vacío: recuperar las tasas previas
    // desde storage (solo si eran de la misma fuente) para no marcar todo "new".
    const prevStore = await browser.storage.local.get(['currentRates', 'ratesSource', 'previousRates']);
    let previous = cachedRates;
    if (Object.keys(previous).length === 0 && prevStore.ratesSource === sourcePreference) {
      previous = prevStore.currentRates || {};
    }

    const changes = calculateChanges(primaryRatesFlat, previous);
    const anyMove = Object.values(changes).some(c => c === 'up' || c === 'down');
    const previousRates = anyMove
      ? previous
      : (prevStore.ratesSource === sourcePreference ? (prevStore.previousRates || {}) : {});

    // Update cache (siempre números planos, para badge)
    cachedRates = primaryRatesFlat;
    cachedChanges = changes;
    cachedBinanceRates = binanceRates;

    const now = new Date().toISOString();
    await browser.storage.local.set({
      currentRates:  primaryRatesFlat,
      ratesSource:   sourcePreference,
      previousRates,
      eltoqueRates,
      bccRates,
      cadecaRates,   // objetos ricos {buy,sell,rate,change} para el popup
      rateChanges:   changes,
      binanceRates,
      lastUpdated:   now,
      fetchError:    null,
    });

    log(`✅ Saved ${Object.keys(primaryRatesFlat).length} rates (${sourcePreference}), ${Object.keys(binanceRates).length} binance`);

    updateBadge();

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'ERROR');

    await browser.storage.local.set({
      fetchError: error.message,
    });

    setBadgeText('ERR', '#dc2626');
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
  } else if (sourceData && typeof sourceData === 'object') {
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
// campo "rate"). Se preservan compra y venta en vez de aplastarlas a un número.
function parseCadecaRates(sourceData) {
  const rates = {};
  if (!sourceData || typeof sourceData !== 'object') return rates;

  for (const [key, value] of Object.entries(sourceData)) {
    if (!value || typeof value !== 'object') continue;

    const buy  = typeof value.buy === 'number' ? value.buy : (value.buy != null ? parseFloat(value.buy) : null);
    const sell = typeof value.sell === 'number' ? value.sell : (value.sell != null ? parseFloat(value.sell) : null);
    const buyOk  = buy  !== null && !isNaN(buy);
    const sellOk = sell !== null && !isNaN(sell);

    if (!buyOk && !sellOk) continue;

    rates[key.toUpperCase()] = {
      buy:  buyOk ? buy : null,
      sell: sellOk ? sell : null,
      rate: sellOk ? sell : buy,
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

// ═══════════════════════════════════════════════
//  Badge
//  (en Android puede no estar soportado: se capturan también los rechazos
//  de las promesas, no solo las excepciones síncronas)
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
    const p1 = browser.action?.setBadgeText?.({ text });
    const p2 = browser.action?.setBadgeBackgroundColor?.({ color: bgColor });
    if (p1 && typeof p1.catch === 'function') p1.catch(() => {});
    if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
  } catch (e) {
    log(`Badge error: ${e.message}`, 'WARN');
  }
}

// ═══════════════════════════════════════════════
//  Messages
// ═══════════════════════════════════════════════
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_NOW') {
    loadSettings().then(() => fetchRates()).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_RATES') {
    Promise.all([loadSettings(), browser.storage.local.get(['currentRates', 'rateChanges', 'binanceRates'])])
      .then(([settings, stored]) => {
        sendResponse({
          rates: Object.keys(cachedRates).length ? cachedRates : (stored.currentRates || {}),
          changes: Object.keys(cachedChanges).length ? cachedChanges : (stored.rateChanges || {}),
          binanceRates: Object.keys(cachedBinanceRates).length ? cachedBinanceRates : (stored.binanceRates || {}),
          settings,
        });
      });
    return true;
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
    (async () => {
      await loadSettings();
      cachedSettings = { ...cachedSettings, ...msg.settings };

      // Si cambió la fuente, actualizar currentRates desde los datos ya cacheados
      const stored = await browser.storage.local.get(['eltoqueRates', 'bccRates', 'cadecaRates']);
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
        // Al cambiar de fuente no hay tasa previa comparable (cachedRates es de
        // otra fuente): se marcan neutrales hasta el próximo refresh.
        const changes = {};
        for (const cur of Object.keys(primaryRatesFlat)) changes[cur] = 'neutral';
        cachedRates = primaryRatesFlat;
        cachedChanges = changes;
        await browser.storage.local.set({
          currentRates: primaryRatesFlat,
          ratesSource: pref,
          rateChanges: changes,
        });
        updateBadge();
      }

      await setupAlarms();
      sendResponse({ ok: true });
    })();
    return true;
  }
});

try {
  log(`Background script loaded (v${browser.runtime.getManifest().version})`);
} catch {
  log('Background script loaded');
}
