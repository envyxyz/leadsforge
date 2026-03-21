const STORAGE_KEYS = {
  LEADS_INDEX: "leads_index",
  LEADS_CHUNK_PREFIX: "leads_chunk_",
  SETTINGS: "settings"
};

const CHUNK_SIZE = 100;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LEADS_INDEX]: { chunkCount: 0, total: 0, updatedAt: new Date().toISOString() },
    [STORAGE_KEYS.SETTINGS]: {}
  });
  console.log("MapLeads Pro installed successfully.");
});

function splitIntoChunks(data, size) {
  const chunks = [];
  for (let i = 0; i < data.length; i += size) {
    chunks.push(data.slice(i, i + size));
  }
  return chunks;
}

async function saveLeadsChunked(leads) {
  const safeLeads = Array.isArray(leads) ? leads : [];
  const chunks = splitIntoChunks(safeLeads, CHUNK_SIZE);

  const keysToClear = [];
  const previous = await chrome.storage.local.get(STORAGE_KEYS.LEADS_INDEX);
  const previousCount = previous?.[STORAGE_KEYS.LEADS_INDEX]?.chunkCount || 0;
  for (let i = 0; i < previousCount; i += 1) {
    keysToClear.push(`${STORAGE_KEYS.LEADS_CHUNK_PREFIX}${i}`);
  }

  if (keysToClear.length) {
    await chrome.storage.local.remove(keysToClear);
  }

  const payload = {
    [STORAGE_KEYS.LEADS_INDEX]: {
      chunkCount: chunks.length,
      total: safeLeads.length,
      updatedAt: new Date().toISOString()
    }
  };

  chunks.forEach((chunk, index) => {
    payload[`${STORAGE_KEYS.LEADS_CHUNK_PREFIX}${index}`] = chunk;
  });

  await chrome.storage.local.set(payload);
}

async function getLeadsChunked() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LEADS_INDEX);
  const meta = result?.[STORAGE_KEYS.LEADS_INDEX] || { chunkCount: 0 };

  if (!meta.chunkCount) {
    return [];
  }

  const keys = Array.from({ length: meta.chunkCount }, (_, index) => `${STORAGE_KEYS.LEADS_CHUNK_PREFIX}${index}`);
  const chunksData = await chrome.storage.local.get(keys);

  const merged = [];
  keys.forEach((key) => {
    const chunk = chunksData[key] || [];
    if (Array.isArray(chunk)) {
      merged.push(...chunk);
    }
  });

  return merged;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "SAVE_LEADS") {
    saveLeadsChunked(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_LEADS") {
    getLeadsChunked()
      .then((leads) => sendResponse({ leads }))
      .catch((error) => sendResponse({ leads: [], error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_LEADS") {
    getLeadsChunked()
      .then(async () => {
        const current = await chrome.storage.local.get(STORAGE_KEYS.LEADS_INDEX);
        const chunkCount = current?.[STORAGE_KEYS.LEADS_INDEX]?.chunkCount || 0;
        const keys = Array.from({ length: chunkCount }, (_, index) => `${STORAGE_KEYS.LEADS_CHUNK_PREFIX}${index}`);
        if (keys.length) {
          await chrome.storage.local.remove(keys);
        }
        await chrome.storage.local.set({
          [STORAGE_KEYS.LEADS_INDEX]: { chunkCount: 0, total: 0, updatedAt: new Date().toISOString() }
        });
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.local
      .set({ [STORAGE_KEYS.SETTINGS]: message.data || {} })
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    chrome.storage.local
      .get(STORAGE_KEYS.SETTINGS)
      .then((result) => sendResponse({ settings: result?.[STORAGE_KEYS.SETTINGS] || {} }))
      .catch((error) => sendResponse({ settings: {}, error: error.message }));
    return true;
  }
});
