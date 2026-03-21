/* global MapLeadsStorage, MapLeadsExporter */

const state = {
  isScanning: false,
  allBusinesses: [],
  leads: [],
  filters: {
    noWebsiteOnly: true,
    includeClosedBusinesses: false,
    deepScan: false,
    scrollDepth: 3
  }
};

const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  await hydrateFromStorage();
  renderAll();
}

function cacheElements() {
  el.statusDot = document.getElementById("statusDot");
  el.statusBanner = document.getElementById("statusBanner");
  el.statusText = document.getElementById("statusText");
  el.btnScan = document.getElementById("btnScan");
  el.btnStop = document.getElementById("btnStop");
  el.btnQuickDownload = document.getElementById("btnQuickDownload");
  el.btnLoader = document.getElementById("btnLoader");
  el.scanButtonText = document.getElementById("scanButtonText");
  el.filterNoWebsite = document.getElementById("filterNoWebsite");
  el.filterIncludeClosed = document.getElementById("filterIncludeClosed");
  el.filterDeepScan = document.getElementById("filterDeepScan");
  el.scrollDepth = document.getElementById("scrollDepth");
  el.scrollDepthVal = document.getElementById("scrollDepthVal");
  el.statsBar = document.getElementById("statsBar");
  el.resultsSection = document.getElementById("resultsSection");
  el.resultsBody = document.getElementById("resultsBody");
  el.countTotal = document.getElementById("countTotal");
  el.countLeads = document.getElementById("countLeads");
  el.countPhone = document.getElementById("countPhone");
  el.btnClear = document.getElementById("btnClear");
  el.exportPanel = document.getElementById("exportPanel");
  el.btnExcel = document.getElementById("btnExcel");
  el.btnCSV = document.getElementById("btnCSV");
  el.btnSheets = document.getElementById("btnSheets");
  el.btnDownload = document.getElementById("btnDownload");
  el.exportNoWebsiteOnly = document.getElementById("exportNoWebsiteOnly");
  el.exportAllFields = document.getElementById("exportAllFields");
  el.btnHelp = document.getElementById("btnHelp");
  el.helpModal = document.getElementById("helpModal");
  el.btnCloseModal = document.getElementById("btnCloseModal");
  el.progressWrap = document.getElementById("progressWrap");
  el.progressFill = document.getElementById("progressFill");
}

function bindEvents() {
  el.btnScan.addEventListener("click", startScan);
  el.btnStop.addEventListener("click", stopScan);
  el.btnQuickDownload.addEventListener("click", handleQuickDownload);
  el.btnClear.addEventListener("click", clearResults);
  el.btnExcel.addEventListener("click", handleExportExcel);
  el.btnCSV.addEventListener("click", handleExportCSV);
  el.btnSheets.addEventListener("click", handleExportSheets);
  el.btnDownload.addEventListener("click", handleQuickDownload);
  el.btnHelp.addEventListener("click", () => el.helpModal.classList.remove("hidden"));
  el.btnCloseModal.addEventListener("click", () => el.helpModal.classList.add("hidden"));
  el.helpModal.addEventListener("click", (event) => {
    if (event.target === el.helpModal) {
      el.helpModal.classList.add("hidden");
    }
  });

  el.filterNoWebsite.addEventListener("change", syncFiltersFromUI);
  el.filterIncludeClosed.addEventListener("change", syncFiltersFromUI);
  el.filterDeepScan.addEventListener("change", syncFiltersFromUI);
  el.scrollDepth.addEventListener("input", syncFiltersFromUI);

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
}

async function hydrateFromStorage() {
  try {
    const settings = await MapLeadsStorage.getSettings();
    const cached = await MapLeadsStorage.getLeads();

    if (settings && settings.filters) {
      state.filters = { ...state.filters, ...settings.filters };
    }
    if (Array.isArray(cached)) {
      state.allBusinesses = cached;
      state.leads = cached.filter((b) => !b.hasWebsite);
    }
  } catch (error) {
    showStatus("error", `Storage error: ${error.message}`);
  }
}

function syncFiltersFromUI() {
  state.filters = {
    noWebsiteOnly: el.filterNoWebsite.checked,
    includeClosedBusinesses: el.filterIncludeClosed.checked,
    deepScan: el.filterDeepScan.checked,
    scrollDepth: Number(el.scrollDepth.value)
  };
  el.scrollDepthVal.textContent = `${state.filters.scrollDepth}x`;
  MapLeadsStorage.saveSettings({ filters: state.filters });
  renderCounters();
}

function renderAll() {
  el.filterNoWebsite.checked = state.filters.noWebsiteOnly;
  el.filterIncludeClosed.checked = state.filters.includeClosedBusinesses;
  el.filterDeepScan.checked = state.filters.deepScan;
  el.scrollDepth.value = String(state.filters.scrollDepth);
  el.scrollDepthVal.textContent = `${state.filters.scrollDepth}x`;

  renderRows();
  renderCounters();
  if (state.allBusinesses.length > 0) {
    el.statsBar.classList.remove("hidden");
    el.resultsSection.classList.remove("hidden");
  }
  updateExportVisibility();
}

async function startScan() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
      showStatus("error", "Error: Not on Google Maps. Open a Maps search results page.");
      return;
    }

    state.allBusinesses = [];
    state.leads = [];
    renderRows();
    renderCounters();

    setUiMode("scanning");
    showStatus("scanning", "Scanning Google Maps...");

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "PING_MAPLEADS"
      });
    } catch (_pingError) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: "START_SCAN",
      filters: state.filters
    });
  } catch (error) {
    setUiMode("idle");
    showStatus("error", `Failed to start scan: ${error.message}`);
  }
}

async function stopScan() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "STOP_SCAN" });
    }
    setUiMode("idle");
    showStatus("idle", "Scan stop requested.");
  } catch (error) {
    showStatus("error", `Unable to stop scan: ${error.message}`);
  }
}

function onRuntimeMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "LEAD_FOUND") {
    const business = message.data;
    if (!business || !business.id) {
      return;
    }

    const alreadyExists = state.allBusinesses.some((item) => item.id === business.id);
    if (alreadyExists) {
      return;
    }

    state.allBusinesses.push(business);
    if (!business.hasWebsite) {
      state.leads.push(business);
    }

    renderRow(business, state.allBusinesses.length - 1);
    renderCounters();
    el.statsBar.classList.remove("hidden");
    el.resultsSection.classList.remove("hidden");
    updateExportVisibility();
  }

  if (message.type === "SCAN_PROGRESS") {
    const percent = Number(message.percent || 0);
    el.progressWrap.classList.remove("hidden");
    el.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (message.stage) {
      showStatus("scanning", message.stage);
    }
  }

  if (message.type === "SCAN_COMPLETE") {
    setUiMode("complete");
    const total = Number(message.total || state.allBusinesses.length);
    const leads = Number(message.leads || state.leads.length);
    showStatus("success", `Found ${leads} no-website leads from ${total} businesses.`);
    updateExportVisibility();
    persistLeads();
  }

  if (message.type === "SCAN_STOPPED") {
    setUiMode("idle");
    showStatus("idle", "Scan stopped.");
    updateExportVisibility();
    persistLeads();
  }

  if (message.type === "SCAN_ERROR") {
    setUiMode("idle");
    showStatus("error", `Error: ${message.error || "Unknown scan failure"}`);
  }
}

function setUiMode(mode) {
  state.isScanning = mode === "scanning";

  if (state.isScanning) {
    el.btnScan.classList.add("loading");
    el.scanButtonText.textContent = "Scanning...";
    el.btnStop.classList.remove("hidden");
    el.statusDot.dataset.state = "scanning";
    el.progressWrap.classList.remove("hidden");
    updateExportVisibility();
  } else {
    el.btnScan.classList.remove("loading");
    el.scanButtonText.textContent = "Start Scan";
    el.btnStop.classList.add("hidden");
    el.statusDot.dataset.state = mode === "error" ? "error" : "idle";
    if (mode !== "complete") {
      el.progressWrap.classList.add("hidden");
      el.progressFill.style.width = "0%";
    } else {
      el.progressFill.style.width = "100%";
    }
    updateExportVisibility();
  }
}

function updateExportVisibility() {
  const hasScrapedData = state.allBusinesses.length > 0;
  el.exportPanel.classList.toggle("hidden", !hasScrapedData);
  el.btnQuickDownload.classList.toggle("hidden", !hasScrapedData);
}

function showStatus(kind, text) {
  el.statusBanner.dataset.state = kind;
  el.statusText.textContent = text;

  if (kind === "error") {
    el.statusDot.dataset.state = "error";
  } else if (state.isScanning) {
    el.statusDot.dataset.state = "scanning";
  } else {
    el.statusDot.dataset.state = "idle";
  }
}

function renderCounters() {
  const visible = getVisibleRowsData();
  const total = state.allBusinesses.length;
  const leadCount = visible.filter((b) => !b.hasWebsite).length;
  const phoneCount = visible.filter((b) => b.phone && b.phone !== "N/A").length;

  animateCounter(el.countTotal, total);
  animateCounter(el.countLeads, leadCount);
  animateCounter(el.countPhone, phoneCount);
}

function animateCounter(element, value) {
  element.textContent = String(value);
  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "countUp 0.24s ease";
}

function renderRows() {
  el.resultsBody.innerHTML = "";
  const rows = getVisibleRowsData();
  rows.forEach((business, index) => renderRow(business, index));
}

function getVisibleRowsData() {
  if (state.filters.noWebsiteOnly) {
    return state.allBusinesses.filter((item) => !item.hasWebsite);
  }
  return state.allBusinesses;
}

function renderRow(business, index) {
  if (state.filters.noWebsiteOnly && business.hasWebsite) {
    return;
  }

  const row = document.createElement("tr");
  row.style.animationDelay = `${Math.min(index * 20, 260)}ms`;
  row.innerHTML = `
    <td title="${escapeHtml(business.name)}">${truncate(business.name, 22)}</td>
    <td title="${escapeHtml(business.category || "N/A")}">${truncate(business.category || "N/A", 14)}</td>
    <td title="${escapeHtml(business.phone || "N/A")}">${truncate(business.phone || "N/A", 16)}</td>
    <td>
      <span class="badge-status ${business.hasWebsite ? "badge-haswebsite" : "badge-nowebsite"}">
        ${business.hasWebsite ? "Has Website" : "No Website"}
      </span>
    </td>
    <td>
      <button class="btn-view" data-url="${encodeURIComponent(business.mapsUrl || "")}" type="button">👁 View</button>
    </td>
  `;

  row.querySelector(".btn-view").addEventListener("click", async (event) => {
    const mapsUrl = decodeURIComponent(event.currentTarget.dataset.url || "");
    if (mapsUrl) {
      await chrome.tabs.create({ url: mapsUrl });
    }
  });

  el.resultsBody.appendChild(row);
}

async function clearResults() {
  state.allBusinesses = [];
  state.leads = [];
  renderRows();
  renderCounters();
  el.exportPanel.classList.add("hidden");
  el.statsBar.classList.add("hidden");
  el.resultsSection.classList.add("hidden");
  await MapLeadsStorage.clearLeads();
  showStatus("idle", "Cleared all saved leads.");
}

async function persistLeads() {
  await MapLeadsStorage.saveLeads(state.allBusinesses);
  await chrome.runtime.sendMessage({ type: "SAVE_LEADS", data: state.allBusinesses });
}

function getExportDataset() {
  const noWebsiteOnly = el.exportNoWebsiteOnly.checked;
  const includeAllFields = el.exportAllFields.checked;
  const base = noWebsiteOnly ? state.allBusinesses.filter((item) => !item.hasWebsite) : state.allBusinesses;
  return { data: base, includeAllFields };
}

function handleExportExcel() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  MapLeadsExporter.exportToExcel(data, "MapLeads", includeAllFields);
  showStatus("success", `Exported ${data.length} leads to Excel.`);
}

function handleExportCSV() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  MapLeadsExporter.exportToCSV(data, "MapLeads", includeAllFields);
  showStatus("success", `Exported ${data.length} leads to CSV.`);
}

function handleExportSheets() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  MapLeadsExporter.exportToGoogleSheets(data, includeAllFields);
  showStatus("success", "CSV downloaded and Google Sheets opened.");
}

function handleQuickDownload() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No scraped data available to download.");
    return;
  }

  MapLeadsExporter.exportToCSV(data, "MapLeads", includeAllFields);
  showStatus("success", `Download started for ${data.length} leads.`);
}

function truncate(value, max) {
  if (!value || value.length <= max) {
    return value || "N/A";
  }
  return `${value.slice(0, max - 1)}…`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
