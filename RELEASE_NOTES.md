# TASALO Firefox — Notas de versión

## v0.1.5 (2026-04-05)

### 🔥 CORRECCIÓN CRÍTICA — Restauración de ES6 Modules

**Problema**: En v0.1.4 se removió incorrectamente `type="module"` pensando que los imports ES6 causaban el problema. **EL DIAGNÓSTICO FUE INCORRECTO**.

**Causa raíz del error**:
- Firefox MV3 **REQUIERE** `type="module"` para poder usar `import` statements
- Sin `type="module"`, los scripts se tratan como "classic scripts"
- Los "classic scripts" NO pueden usar `import` → error de sintaxis
- Error de sintaxis previene ejecución del script → páginas en blanco
- **Sin errores en consola** porque el script nunca carga

**Lo que realmente causaba el problema original**:
1. `apiUrl` antigua en storage con `https://` (ya migrado en v0.1.3.2)
2. Falta de `credentials: 'omit'` en fetch (ya agregado en v0.1.3.2)
3. Falta de timeout con AbortController (ya agregado en v0.1.3.2)

**Correcciones aplicadas**:
- ✅ **Restaurado `type="module"`** en manifest.json background
- ✅ **Restaurado `type="module"`** en todos los script tags de HTML
- ✅ **Restaurados imports ES6** en todos los archivos JS
- ✅ **Convertido newtab-init.js** a script inline (como Android)
- ✅ **Agregado manejo de errores** robusto con try-catch
- ✅ **Agregado console logging** en cada paso de inicialización

**Arquitectura final** (igual que Android):
```
manifest.json → "type": "module" en background
├── background.js → import from constants.js ✅
├── popup.js → import from constants.js ✅
├── options.js → import from constants.js ✅
├── newtab.js → import from constants.js ✅
└── newtab.html → inline init script (type="module") ✅
```

**Lección aprendida**: 
> Firefox MV3 NECESITA `type="module"` para usar imports ES6. Removerlo rompe completamente la extensión.

---

## v0.1.4 (2026-04-05) [DESCARTADA - DIAGNÓSTICO INCORRECTO]

⚠️ **Esta versión fue un error de diagnóstico**. Se removió `type="module"` incorrectamente, lo que rompió la extensión completamente. Los cambios de v0.1.4 fueron revertidos en v0.1.5.

---

## v0.1.3.3 (2026-04-06)

### Correcciones de bugs

Bug 1 — host_permissions con https:// en lugar de http:// (ya detectado antes)
Firefox rechazaba silenciosamente todo fetch porque el permiso declarado no coincidía con el protocolo real.
Bug 2 — apiUrl vieja en storage (nuevo)
Si ya tenías instalada la extensión antes, el valor apiUrl: "https://..." quedó guardado en browser.storage.local. Aunque corrijas el manifest, el código lee primero el storage:
jsconst apiUrl = cachedSettings.apiUrl || DEFAULT_API_URL;
...y sigue usando HTTPS. La v0.1.3.2 migra automáticamente ese valor al arrancar.
Bug 3 — fetch sin credentials: 'omit' ni timeout (nuevo)
Firefox, a diferencia de Chrome, puede intentar incluir credenciales en peticiones cross-origin si no se especifica explícitamente. Eso dispara un CORS preflight que el servidor de la API nunca atiende, bloqueando la respuesta. Se alineó el fetch con la versión Android que ya tenía credentials: 'omit', cache: 'no-cache' y AbortController de 10s.
Bug 4 — script inline en newtab.html (nuevo)
Firefox MV3 tiene CSP script-src 'self' por defecto, que bloquea todo <script type="module"> inline. El script de la nueva pestaña fue movido a src/newtab-init.js.


## v0.1.3.2 (2026-04-06)

### Correcciones críticas (4 bugs que bloqueaban la conexión)

1. **`host_permissions` con protocolo incorrecto** — el manifest declaraba `https://tasalo.duckdns.org:8040/*` pero la API usa `http://`. Firefox bloqueaba silenciosamente todos los fetch. Corregido a `http://`.

2. **Migración automática de `apiUrl` almacenada** — si una instalación anterior guardó en storage una `apiUrl` con `https://`, el fetch seguía fallando aunque se corrigiera el manifest. Ahora el background detecta y corrige automáticamente el valor guardado al arrancar.

3. **fetch sin `credentials: 'omit'` ni `cache: 'no-cache'`** — Firefox puede intentar enviar credenciales en peticiones cross-origin, desencadenando un CORS preflight que el servidor no atiende. Alineado con la versión Android que ya tenía estas opciones. También se añadió `AbortController` con timeout de 10s.

4. **Script inline en `newtab.html`** — Firefox MV3 bloquea scripts inline por CSP (`script-src 'self'`). El script de inicialización de la nueva pestaña fue movido a `src/newtab-init.js`.

### Mejoras menores
- `extractRateValue` usa `??` en lugar de `||` para no descartar tasas con valor `0`.
- `browser.omnibox` envuelto en guard `if (browser.omnibox)` para evitar crash si la API no está disponible.

## v0.1.3 (2026-04-05)

### Nuevas funcionalidades
- **Source Switch**: botones para cambiar rápidamente entre El Toque y BCC directamente desde el popup, igual que Chrome.
- **Tasas por fuente separadas**: el background ahora guarda `eltoqueRates`, `bccRates` y `cadecaRates` de forma independiente; el popup y la nueva pestaña usan la fuente seleccionada directamente sin mezclar.
- **Badge fuente-aware**: el badge del icono muestra el USD de la fuente seleccionada y el tooltip indica la fuente (`ElToque`, `BCC`, o `CADECA`).
- **Broadcast a pestañas**: después de cada fetch, el background notifica a todas las pestañas abiertas con las nuevas tasas.
- **ES modules**: `background.js` ahora usa `import` desde `constants.js` (manifest actualizado con `"type": "module"`).

### Correcciones
- **Omnibox mejorado**: las sugerencias se ordenan por preferencia, se puede buscar por nombre de moneda y muestran si la tasa subió/bajó.
- **Alarma ROTATE**: sustituye el `setInterval` de rotación; el badge se refresca cada 10 minutos via alarm (más consistente con Chrome y fiable tras suspensión del sistema).
- **Render con innerHTML**: tarjetas del popup, lista de monedas en opciones y ticker de Binance usan `innerHTML` para mayor consistencia con Chrome.
- **Reset de settings**: usa `deepClone` en lugar de `JSON.parse(JSON.stringify(...))`.

### Mejoras visuales
- Popup más ancho: `360px` → `420px`.
- Fuente y padding de tarjetas de tasa ajustados para consistencia con Chrome.
- Estilos del Source Switch añadidos al popup.css.

## v0.1.2 (2026-04-02)
- **Versión mínima de Firefox corregida**: `strict_min_version` cambió de `142.0`
  a `115.0`, eliminando el bloqueo de instalación en Firefox estable.
- Carga de `eltoqueRates` y `bccRates` desde storage al arrancar.
- Badge con USD actualizado al iniciar.

## v0.1.1 (2026-03-30)
- Rotación del badge con `setInterval` (más fluida en Firefox persistente).
- Carga de estado desde storage al arrancar (`onStartup`).

## v0.1.0 (2026-03-29)
- Lanzamiento inicial.
- Tasas de El Toque y BCC, badge con USD.
