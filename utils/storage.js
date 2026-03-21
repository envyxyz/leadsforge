const MapLeadsStorage = (() => {
  const LOCAL_KEYS = {
    LEADS_CACHE: "popup_leads_cache",
    SETTINGS_CACHE: "popup_settings_cache"
  };

  async function saveLeads(leads) {
    const safeLeads = Array.isArray(leads) ? leads : [];
    await chrome.storage.local.set({ [LOCAL_KEYS.LEADS_CACHE]: safeLeads });
    await chrome.runtime.sendMessage({ type: "SAVE_LEADS", data: safeLeads });
    return true;
  }

  async function getLeads() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_LEADS" });
      if (Array.isArray(response?.leads)) {
        return response.leads;
      }
    } catch (_error) {
      // Fallback to local cache if service worker is asleep.
    }

    const result = await chrome.storage.local.get(LOCAL_KEYS.LEADS_CACHE);
    return result?.[LOCAL_KEYS.LEADS_CACHE] || [];
  }

  async function clearLeads() {
    await chrome.storage.local.remove(LOCAL_KEYS.LEADS_CACHE);
    await chrome.runtime.sendMessage({ type: "CLEAR_LEADS" });
  }

  async function saveSettings(settings) {
    const safeSettings = settings && typeof settings === "object" ? settings : {};
    await chrome.storage.local.set({ [LOCAL_KEYS.SETTINGS_CACHE]: safeSettings });
    try {
      await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", data: safeSettings });
    } catch (_error) {
      // Keep local-only settings when runtime message fails.
    }
    return true;
  }

  async function getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      if (response?.settings && typeof response.settings === "object") {
        return response.settings;
      }
    } catch (_error) {
      // Fallback to local cache when unavailable.
    }

    const result = await chrome.storage.local.get(LOCAL_KEYS.SETTINGS_CACHE);
    return result?.[LOCAL_KEYS.SETTINGS_CACHE] || {};
  }

  return {
    saveLeads,
    getLeads,
    clearLeads,
    saveSettings,
    getSettings
  };
})();
