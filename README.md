# TASALO Extension — Firefox

> Tasas de cambio Cuba en Firefox — El Toque, BCC, Binance

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/TASALO-TEAM/taso-extmf)
[![Firefox](https://img.shields.io/badge/Firefox-109+-orange.svg)](https://www.mozilla.org/firefox/)

## 🦊 Exclusiva para Firefox

Esta es la versión **exclusiva para Firefox** de la extensión TASALO.

## ✨ Características

- 💱 Tasas de El Toque, BCC y Binance
- 🎨 Diseño Liquid Glass
- ⚡ Actualización automática cada 5 minutos
- 🔍 Omnibox con `tsl`
- 🗂 New Tab opcional
- ⚙️ Configurable

## 📦 Instalación en Firefox

### Desarrollo

1. Abrí Firefox
2. Escribí `about:debugging#/runtime/this-firefox`
3. Click en **"Load Temporary Add-on..."**
4. Navegá a `/home/ersus/tasalo/taso-extmf/`
5. Seleccioná `manifest.json`
6. ✅ ¡Listo!

### Producción (AMO)

Próximamente en [Firefox Add-ons](#)

## 🚀 Uso

### Popup
- Click en el ícono de TASALO
- Ver tasas de El Toque o BCC
- Ticker de Binance abajo

### New Tab
- `Ctrl+T` → Dashboard TASALO
- Opcional: desactivar en Options

### Omnibox
- Escribir `tsl` en la barra
- `tsl USD` → Ver tasa del Dólar
- `tsl EUR` → Ver tasa del Euro

### Options
- Click derecho en ícono → Options
- Activar/desactivar New Tab
- Intervalo de actualización
- Tema (Auto/Dark/Light)

## 🔧 Configuración

**API URL:** `https://tasalo.duckdns.org`

**Default:**
- New Tab: ✅ Activado
- Update interval: 5 min
- Theme: Auto

## 📊 Estado

| Componente | Estado |
|------------|--------|
| Popup | ✅ Funciona |
| New Tab | ✅ Funciona |
| Omnibox | ✅ Funciona |
| Options | ✅ Funciona |
| Background | ✅ Funciona |

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

## 📝 Archivos

```
taso-extmf/
├── manifest.json       # Firefox Manifest V3
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js   # Firefox background script
│   ├── popup.html      # Popup UI
│   ├── popup.js        # Popup logic
│   ├── newtab.html     # New Tab page
│   ├── newtab.js       # New Tab logic
│   ├── options.html    # Options page
│   └── constants.js    # Constants
└── README.md
```

## 🔗 Links

- **GitHub:** https://github.com/TASALO-TEAM/taso-extmf
- **API:** https://tasalo.duckdns.org
- **Chrome version:** https://github.com/TASALO-TEAM/taso-ext

## 📄 License

MIT

---

**Hecho para Firefox 🦊**
