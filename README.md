# TASALO — Tasas de Cambio Cuba (Firefox) 🦊

> Tasas de cambio del dólar en Cuba en Firefox — El Toque, BCC, Binance

[![Version](https://img.shields.io/badge/version-0.1.2--android-blue.svg)](https://github.com/TASALO-TEAM/taso-extmf)
[![Firefox](https://img.shields.io/badge/Firefox-140+-orange.svg)](https://www.mozilla.org/firefox/)
[![Mozilla Add-ons](https://img.shields.io/amo/v/tasalo-tasas-de-cambio-cuba.svg?label=desktop)](https://addons.mozilla.org/es-ES/firefox/addon/tasalo-tasas-de-cambio-cuba/)
[![Mozilla Add-ons](https://img.shields.io/amo/v/tasalo-cambio-cuba-android.svg?label=android)](https://addons.mozilla.org/es-ES/firefox/addon/tasalo-cambio-cuba-android/)

## 🦊 Versión para Firefox

Esta es la versión **exclusiva para Firefox** de la extensión TASALO. Disponible para **Firefox Desktop** y **Firefox Android**.

## ✨ Características

- 💱 Tasas de El Toque, BCC y Binance
- 🎨 Diseño Liquid Glass
- ⚡ Actualización automática cada 5 minutos
- 🔀 Switch de fuente — Cambia entre El Toque y BCC
- 🔍 Omnibox con `tsl`
- 🗂 New Tab opcional
- 📱 Firefox Android soportado

## 📦 Instalación

### Firefox Desktop

#### Desde Mozilla Add-ons

1. Visita la página de la extensión: **[TASALO en Mozilla Add-ons](https://addons.mozilla.org/es-ES/firefox/addon/tasalo-tasas-de-cambio-cuba/)**
2. Click en **"Añadir a Firefox"**
3. Confirma la instalación
4. ✅ ¡Listo! Verás el ícono de TASALO en tu barra

#### Desarrollo (temporal)

1. Abre Firefox
2. Escribe `about:debugging#/runtime/this-firefox`
3. Click en **"Cargar complemento temporal"** (o "Load Temporary Add-on")
4. Navega a la carpeta `taso-extmf/` y selecciona `manifest.json`
5. ✅ ¡Listo! (se elimina al cerrar Firefox)

### Firefox Android

#### Desde Mozilla Add-ons

1. Abre Firefox en tu dispositivo Android
2. Visita: **[TASALO Android en Mozilla Add-ons](https://addons.mozilla.org/es-ES/firefox/addon/tasalo-cambio-cuba-android/)**
3. Click en **"Añadir a Firefox"**
4. Confirma la instalación
5. ✅ ¡Listo! Accede desde el menú de extensiones de Firefox Android

#### Requisitos

- **Firefox Android:** 142 o superior
- **Firefox Desktop:** 140 o superior

## 🚀 Uso

### Popup
- Click en el ícono de TASALO
- Ver tasas de El Toque o BCC (usa los switches)
- Ticker de Binance con criptomonedas abajo

### New Tab
- `Ctrl+T` → Dashboard TASALO (ElToque + BCC + Binance)
- **Opcional:** desactivar en Options si prefieres tu página habitual

### Omnibox
- Escribir `tsl` en la barra de direcciones
- `tsl USD` → Ver tasa del Dólar
- `tsl EUR` → Ver tasa del Euro
- `tsl BTC` → Ver precio de Bitcoin

### Options
- Click derecho en ícono → Options
- Activar/desactivar New Tab
- Intervalo de actualización
- Tema (Auto/Dark/Light)
- Fuente preferida (El Toque / BCC)

## 🔧 Configuración

**API URL:** `https://tasalo.duckdns.org`

**Por defecto:**
- New Tab: ✅ Activado
- Update interval: 5 min
- Theme: Auto
- Fuente: El Toque

## 📊 Estado

| Componente | Estado |
|------------|--------|
| Popup | ✅ Funciona |
| New Tab | ✅ Funciona |
| Omnibox | ✅ Funciona |
| Options | ✅ Funciona |
| Background | ✅ Funciona |
| Firefox Android | ✅ Funciona |

## 📁 Estructura del Proyecto

```
taso-extmf/
├── manifest.json       # Firefox Manifest V3
├── RELEASE_NOTES.md    # Notas de versión
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js   # Firefox background script
│   ├── constants.js    # Constantes
│   ├── popup.html      # Popup UI
│   ├── popup.js        # Popup logic
│   ├── newtab.html     # New Tab page
│   ├── newtab.js       # New Tab logic
│   ├── newtab-init.js  # External init (CSP compliance)
│   ├── options.html    # Options page
│   └── options.js      # Options logic
├── android/
│   ├── manifest.json   # Firefox Android manifest
│   ├── icons/          # Android icons
│   └── src/            # Android source files
└── README.md
```

## 🐛 Debugging

**Firefox Console:**
```
about:debugging → This Firefox → TASALO → Inspect
```

**Popup Console:**
```
Click popup → F12 → Console
```

**New Tab Console:**
```
Ctrl+T → F12 → Console
```

**Firefox Android:**
```
about:debugging → USB/Network debugging → TASALO → Inspect
```

## 📝 Changelog

### 0.1.2-android (2026-04-06)

- ✅ **Firefox Android:** Extensión completa para Android
- ✅ **CSP compliance:** `newtab-init.js` externo para Content Security Policy
- ✅ **Iconos Android:** 16x16, 32x32, 48x48, 128x128, icon.ico
- ✅ **RELEASE_NOTES.md:** Documentación completa

### 0.1.1 (2026-03-30)

- ✅ Publicado en Mozilla Add-ons
- ✅ `strict_min_version: 140.0`
- ✅ `data_collection_permissions: required: ["none"]`
- ✅ Background script sin ES6 modules (inline)

### 0.1.0 (2026-03-29)

- ✅ Initial release para Firefox

## 🔗 Links

- **Mozilla Add-ons (Desktop):** https://addons.mozilla.org/es-ES/firefox/addon/tasalo-tasas-de-cambio-cuba/
- **Mozilla Add-ons (Android):** https://addons.mozilla.org/es-ES/firefox/addon/tasalo-cambio-cuba-android/
- **GitHub:** https://github.com/TASALO-TEAM/taso-extmf
- **API:** https://tasalo.duckdns.org
- **Versión Chrome:** https://github.com/TASALO-TEAM/taso-ext

## 📄 Licencia

MIT

---

**Hecho para Firefox 🦊**

**Nota:** Las tasas mostradas son referenciales y pueden variar. Siempre verifica con la fuente oficial.

**Disclaimer:** TASALO no es una aplicación oficial. Los datos se obtienen de fuentes públicas.
