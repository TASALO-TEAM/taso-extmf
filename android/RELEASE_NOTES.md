# TASALO Android — Notas de versión

## v0.2.0.0 (2026-09-28)

### Correcciones
- **Causa raíz de que no cargara nada en Firefox Android**: la extensión usaba
  `http://tasalo.duckdns.org:8040`. El CSP por defecto de MV3 en Firefox incluye
  `upgrade-insecure-requests`, que reescribe todo `fetch` de `http://` a
  `https://`; la petición salía a `https://…:8040` (puerto sin TLS) y fallaba
  siempre. Ahora usa `https://tasalo.duckdns.org` (Caddy, 443), igual que la
  extensión de escritorio, y `host_permissions` se actualizó a `https://`.
- **Migración de `apiUrl` guardada**: instalaciones previas conservaban la URL
  vieja en `storage` (pisaba el default). Al cargar settings se reemplaza
  automáticamente cualquier `http://tasalo.duckdns.org[:puerto]` por la nueva.
- **Settings al despertar el background**: Firefox Android suspende el event
  page; al despertar se perdía la fuente elegida y la URL. Ahora los settings se
  recargan desde storage al cargar el script y antes de cada refresh, mensaje
  `FETCH_NOW`/`GET_RATES`/`UPDATE_SETTINGS`.
- **Cambios de tasa tras suspensión**: ya no marca todo como "new" al despertar
  (se recuperan las tasas previas desde storage si son de la misma fuente) y se
  guarda `previousRates` para mostrar la diferencia en las tarjetas.
- **Cambio de fuente**: los cambios ya no se calculan contra las tasas de otra
  fuente; el badge se actualiza al instante.
- **Fallback silencioso a El Toque**: si la fuente elegida no tenía datos, el
  popup mostraba El Toque bajo su etiqueta. Ahora muestra solo los datos de la
  fuente activa ("Sin datos de X por ahora").
- **Panel de ajustes cortado** en pantallas chicas (`overflow: hidden`): el
  popup ahora puede scrollear.
- Badge: se capturan los rechazos de promesa si la API no está soportada.
- Eliminado código muerto (`extractAllRates`) y versiones hardcodeadas en logs.

### Paridad con la extensión de escritorio
- **CADECA** como tercera fuente (Compra–Venta, sin aplastar a un solo número).
- Monedas mostradas derivadas de las tasas reales de la fuente (respeta
  `selectedCurrencies`), en vez de listas fijas por fuente.
- Ticker respeta `tickerEnabled` y `scrollSpeed`.
- Rediseño visual "Quiet Glass" v2 (paleta clara suave, radios más redondeados,
  un solo acento), con hover/glare solo en dispositivos con puntero.
- Sin cambios a propósito: banderas como emoji nativo (Android las renderiza),
  sin frase del día/combustible (dependen del newtab, que Android no tiene).

## v0.1.4 (2026-04-02)

### Correcciones
- **Bug crítico — fuente preferida ignorada**: `extractAllRates()` mezclaba las
  tres fuentes con `Object.assign` en orden `eltoque → cadeca → bcc`, por lo que
  BCC sobreescribía los valores de El Toque para USD y EUR. El popup mostraba
  tasas de BCC siempre, independientemente de la preferencia del usuario.
  Ahora cada fuente se extrae por separado y `currentRates` corresponde
  únicamente a la fuente seleccionada (`sourcePreference`).
- **Settings no se cargaban al inicio**: `cachedSettings` en el background
  siempre usaba `DEFAULT_SETTINGS` al arrancar (ignorando lo guardado por el
  usuario). Corregido en `onInstalled` y `onStartup` cargando desde storage
  antes del primer fetch.
- **Cambio de fuente en tiempo real**: al guardar una preferencia de fuente
  distinta en el popup, `currentRates` se actualiza inmediatamente desde los
  datos ya cacheados sin esperar al próximo ciclo de refresh.
- **Storage**: se persisten `eltoqueRates`, `bccRates` y `cadecaRates` por
  separado, facilitando futuros cambios de fuente instantáneos.

## v0.1.2 (2026-04-02)

### Correcciones
- **Fuente CADECA agregada**: el endpoint `/api/v1/tasas/latest` devuelve tasas de
  `eltoque`, `cadeca` y `bcc`, pero la extensión solo procesaba `eltoque` y `bcc`.
  Ahora se incluyen las tres fuentes correctamente.
- **Parsing de tasas mejorado**: `extractRateValue` ahora usa `??` en lugar de `||`
  para no descartar valores numéricos iguales a `0`, y prioriza el campo `sell`
  de CADECA (tasa de venta oficial) cuando `rate` no está presente.
- **Timeout de red**: el fetch incluye un `AbortController` de 10 segundos para
  evitar que la extensión quede colgada si el servidor no responde.
- **Errores de red descriptivos**: se diferencia entre timeout, sin conexión y
  error HTTP para facilitar el diagnóstico desde la consola.

### Nota para el servidor
La API usa `CORSMiddleware` con `allow_credentials=True` y `allow_origins=["*"]`.
Esta combinación es inválida en CORS — Firefox la rechaza. Para corregirlo, en
`src/main.py` cambiar a `allow_credentials=False`, o bien declarar los orígenes
exactos en vez de `"*"`.

## v0.1.1 (2026-04-02)
- URL de API corregida: `http://tasalo.duckdns.org:8040`.
- `host_permissions` actualizado al puerto 8040.
- `strict_min_version` establecido en `142.0` con `data_collection_permissions`
  requerido por Mozilla Add-ons.

## v0.1.0 (2026-03-29)
- Lanzamiento inicial para Firefox Android.
- Soporte para tasas de El Toque y BCC.
- Badge con precio del USD en tiempo real.
