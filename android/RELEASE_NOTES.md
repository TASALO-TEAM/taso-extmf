# TASALO Android — Notas de versión

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
