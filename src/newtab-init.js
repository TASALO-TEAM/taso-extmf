// TASALO — NewTab init script (externo para cumplir CSP de Firefox MV3)
const browser = globalThis.browser || globalThis.chrome;

async function init() {
  try {
    const data = await browser.storage.local.get('settings');
    const settings = data.settings || {};

    if (settings.newTabEnabled === false) {
      browser.tabs.create({ url: 'https://www.google.com' });
      browser.tabs.getCurrent((tab) => {
        if (tab) browser.tabs.remove(tab.id);
      });
    }
  } catch (error) {
    console.error('[NewTab] Error:', error);
  }
}

init();
