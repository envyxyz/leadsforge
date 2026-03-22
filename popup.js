/* global LeadsForgeStorage, LeadsForgeExporter */

const state = {
  isScanning: false,
  allBusinesses: [],
  selectedIds: new Set(),
  filters: {
    mustHave: [],
    minRating: 0,
    excludeClosed: true,
    deepScan: false,
    scrollDepth: 3
  },
  locations: [],
  currentLocationIndex: 0,
  rawLocations: ""
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
  el.btnLoader = document.getElementById("btnLoader");
  el.scanButtonText = document.getElementById("scanButtonText");
  el.mustHaveGroup = document.getElementById("mustHaveGroup");
  el.filterMinRating = document.getElementById("filterMinRating");
  el.minRatingVal = document.getElementById("minRatingVal");
  el.filterDeepScan = document.getElementById("filterDeepScan");
  el.scrollDepth = document.getElementById("scrollDepth");
  el.scrollDepthVal = document.getElementById("scrollDepthVal");
  el.locationInput = document.getElementById("locationInput");
  el.statsBar = document.getElementById("statsBar");
  el.resultsSection = document.getElementById("resultsSection");
  el.resultsBody = document.getElementById("resultsBody");
  el.resultsCount = document.getElementById("resultsCount");
  el.countTotal = document.getElementById("countTotal");
  el.countLeads = document.getElementById("countLeads");
  el.countPhone = document.getElementById("countPhone");
  el.countEmail = document.getElementById("countEmail");
  el.btnSelectAll = document.getElementById("btnSelectAll");
  el.btnDeselectAll = document.getElementById("btnDeselectAll");
  el.checkAllHeader = document.getElementById("checkAllHeader");
  el.btnClear = document.getElementById("btnClear");
  el.exportPanel = document.getElementById("exportPanel");
  el.btnExcel = document.getElementById("btnExcel");
  el.btnCSV = document.getElementById("btnCSV");
  el.btnSheets = document.getElementById("btnSheets");
  el.exportAllFields = document.getElementById("exportAllFields");
  el.btnHelp = document.getElementById("btnHelp");
  el.helpModal = document.getElementById("helpModal");
  el.btnCloseModal = document.getElementById("btnCloseModal");
  el.progressWrap = document.getElementById("progressWrap");
  el.progressFill = document.getElementById("progressFill");
  el.progressLabel = document.getElementById("progressLabel");
}

function bindEvents() {
  el.btnScan.addEventListener("click", startScan);
  el.btnStop.addEventListener("click", stopScan);
  el.btnClear.addEventListener("click", clearResults);
  el.btnExcel.addEventListener("click", handleExportExcel);
  el.btnCSV.addEventListener("click", handleExportCSV);
  el.btnSheets.addEventListener("click", handleExportSheets);
  el.btnHelp.addEventListener("click", () => el.helpModal.classList.remove("hidden"));
  el.btnCloseModal.addEventListener("click", () => el.helpModal.classList.add("hidden"));
  el.helpModal.addEventListener("click", (event) => {
    if (event.target === el.helpModal) {
      el.helpModal.classList.add("hidden");
    }
  });

  el.btnSelectAll.addEventListener("click", selectAll);
  el.btnDeselectAll.addEventListener("click", deselectAll);
  el.checkAllHeader.addEventListener("change", () => {
    if (el.checkAllHeader.checked) {
      selectAll();
    } else {
      deselectAll();
    }
  });

  el.mustHaveGroup.addEventListener("change", syncFiltersFromUI);
  el.filterMinRating.addEventListener("input", syncFiltersFromUI);
  el.filterDeepScan.addEventListener("change", syncFiltersFromUI);
  el.scrollDepth.addEventListener("input", syncFiltersFromUI);
  el.locationInput.addEventListener("input", syncFiltersFromUI);

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
}

async function hydrateFromStorage() {
  try {
    const settings = await LeadsForgeStorage.getSettings();
    const cached = await LeadsForgeStorage.getLeads();

    if (settings && settings.filters) {
      state.filters = { ...state.filters, ...settings.filters };
    }
    if (settings && settings.rawLocations) {
      state.rawLocations = settings.rawLocations;
    }
    if (Array.isArray(cached) && cached.length > 0) {
      state.allBusinesses = cached;
      cached.forEach((b) => state.selectedIds.add(b.id));
    }
  } catch (error) {
    showStatus("error", `Storage error: ${error.message}`);
  }
}

function syncFiltersFromUI() {
  const mustHave = [...el.mustHaveGroup.querySelectorAll("input:checked")].map((cb) => cb.value);

  state.filters = {
    mustHave,
    minRating: Number(el.filterMinRating.value),
    deepScan: el.filterDeepScan.checked,
    scrollDepth: Number(el.scrollDepth.value)
  };

  el.scrollDepthVal.textContent = `${state.filters.scrollDepth}x`;
  el.minRatingVal.textContent = state.filters.minRating > 0 ? `${state.filters.minRating}` : "Any";

  state.rawLocations = el.locationInput.value;

  LeadsForgeStorage.saveSettings({ filters: state.filters, rawLocations: state.rawLocations });
  renderRows();
  renderCounters();
}

function renderAll() {
  const savedMustHave = state.filters.mustHave || [];
  el.mustHaveGroup.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = savedMustHave.includes(cb.value);
  });
  el.filterMinRating.value = String(state.filters.minRating || 0);
  el.minRatingVal.textContent = state.filters.minRating > 0 ? `${state.filters.minRating}` : "Any";
  el.filterDeepScan.checked = state.filters.deepScan || false;
  el.scrollDepth.value = String(state.filters.scrollDepth || 3);
  el.scrollDepthVal.textContent = `${state.filters.scrollDepth || 3}x`;
  el.locationInput.value = state.rawLocations || "";

  renderRows();
  renderCounters();
  if (state.allBusinesses.length > 0) {
    el.statsBar.classList.remove("hidden");
    el.resultsSection.classList.remove("hidden");
  }
  updateExportVisibility();
}

function parseLocations() {
  const raw = el.locationInput.value.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function startScan() {
  const locations = parseLocations();

  if (locations.length > 0) {
    await startMultiLocationScan(locations);
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
      showStatus("error", "Not on Google Maps. Open a Maps search page or enter locations above.");
      return;
    }

    state.allBusinesses = [];
    state.selectedIds.clear();
    renderRows();
    renderCounters();
    setUiMode("scanning");
    showStatus("scanning", "Scanning Google Maps...");

    await ensureContentScript(tab.id);

    await chrome.tabs.sendMessage(tab.id, {
      type: "START_SCAN",
      filters: state.filters
    });
  } catch (error) {
    setUiMode("idle");
    showStatus("error", `Failed to start scan: ${error.message}`);
  }
}

async function startMultiLocationScan(locations) {
  state.allBusinesses = [];
  state.selectedIds.clear();
  state.locations = locations;
  state.currentLocationIndex = 0;
  renderRows();
  renderCounters();
  setUiMode("scanning");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showStatus("error", "No active tab found.");
      setUiMode("idle");
      return;
    }

    for (let i = 0; i < locations.length; i++) {
      if (!state.isScanning) {
        break;
      }

      state.currentLocationIndex = i;
      const query = locations[i];
      showStatus("scanning", `Navigating: "${query}" (${i + 1}/${locations.length})`);

      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      await chrome.tabs.update(tab.id, { url });

      // Wait for page to load
      await waitForPageLoad(tab.id, 8000);

      showStatus("scanning", `Scanning: "${query}" (${i + 1}/${locations.length})`);

      await ensureContentScript(tab.id);

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "START_SCAN",
          filters: state.filters
        });
      } catch (err) {
        console.warn("LeadsForge: scan message failed for location", query, err);
      }

      // Wait for scan to complete for this location
      await waitForScanComplete();

      if (i < locations.length - 1 && state.isScanning) {
        showStatus("scanning", `Completed "${query}", moving to next...`);
        await sleep(2000);
      }
    }

    if (state.isScanning) {
      setUiMode("complete");
      showStatus("success", `Multi-scan complete. ${state.allBusinesses.length} total leads from ${locations.length} locations.`);
      updateExportVisibility();
      persistLeads();
    }
  } catch (error) {
    setUiMode("idle");
    showStatus("error", `Multi-location scan failed: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPageLoad(tabId, timeout = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > timeout) {
        resolve();
        return;
      }
      chrome.tabs.get(tabId, (tab) => {
        if (tab?.status === "complete") {
          setTimeout(resolve, 2000);
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

function waitForScanComplete() {
  return new Promise((resolve) => {
    const handler = (message) => {
      if (message?.type === "SCAN_COMPLETE" || message?.type === "SCAN_STOPPED" || message?.type === "SCAN_ERROR") {
        chrome.runtime.onMessage.removeListener(handler);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    // Safety timeout after 5 minutes
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      resolve();
    }, 300000);
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_LEADSFORGE" });
  } catch (_pingError) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await sleep(500);
  }
}

async function stopScan() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "STOP_SCAN" });
    }
    setUiMode("idle");
    showStatus("idle", "Scan stopped.");
    updateExportVisibility();
    persistLeads();
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
    state.selectedIds.add(business.id);

    renderRow(business, state.allBusinesses.length - 1);
    renderCounters();
    el.statsBar.classList.remove("hidden");
    el.resultsSection.classList.remove("hidden");
    updateExportVisibility();
    updateResultsCount();
  }

  if (message.type === "SCAN_PROGRESS") {
    const percent = Number(message.percent || 0);
    el.progressWrap.classList.remove("hidden");
    el.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (el.progressLabel) {
      el.progressLabel.textContent = `${Math.round(percent)}%`;
    }
    if (message.stage) {
      showStatus("scanning", message.stage);
    }
  }

  if (message.type === "SCAN_COMPLETE") {
    // Only finalize if not doing multi-location
    if (state.locations.length <= 1 || state.currentLocationIndex >= state.locations.length - 1) {
      setUiMode("complete");
      const total = state.allBusinesses.length;
      showStatus("success", `Scan complete! Found ${total} businesses.`);
      updateExportVisibility();
      persistLeads();
    }
  }

  if (message.type === "SCAN_STOPPED") {
    setUiMode("idle");
    showStatus("idle", "Scan stopped.");
    updateExportVisibility();
    persistLeads();
  }

  if (message.type === "SCAN_ERROR") {
    if (state.locations.length <= 1) {
      setUiMode("idle");
    }
    showStatus("error", `Error: ${message.error || "Unknown scan failure"}`);
  }
}

function setUiMode(mode) {
  state.isScanning = mode === "scanning";

  if (state.isScanning) {
    el.btnScan.classList.add("loading");
    el.scanButtonText.textContent = "SCANNING...";
    el.btnStop.classList.remove("hidden");
    el.statusDot.dataset.state = "scanning";
    el.progressWrap.classList.remove("hidden");
    updateExportVisibility();
  } else {
    el.btnScan.classList.remove("loading");
    el.scanButtonText.textContent = "START SCAN";
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
  const hasData = state.allBusinesses.length > 0;
  el.exportPanel.classList.toggle("hidden", !hasData);
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
  const leadCount = visible.length;
  const phoneCount = visible.filter((b) => b.phone && b.phone !== "N/A").length;
  const emailCount = visible.filter((b) => b.email && b.email !== "N/A").length;

  animateCounter(el.countTotal, total);
  animateCounter(el.countLeads, leadCount);
  animateCounter(el.countPhone, phoneCount);
  animateCounter(el.countEmail, emailCount);
}

function animateCounter(element, value) {
  if (!element) return;
  element.textContent = String(value);
  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "countUp 0.24s ease";
}

function getVisibleRowsData() {
  let data = [...state.allBusinesses];

  // Filter by must-have fields
  const mustHave = state.filters.mustHave || [];
  if (mustHave.length > 0) {
    data = data.filter((b) => {
      return mustHave.every((field) => {
        switch (field) {
          case "email":    return b.email && b.email !== "N/A";
          case "phone":    return b.phone && b.phone !== "N/A";
          case "website":  return b.hasWebsite && b.website;
          case "opened":   return !b.isPossiblyClosed && b.isOpen !== false;
          case "facebook": return b.socials?.facebook;
          case "instagram":return b.socials?.instagram;
          case "twitter":  return b.socials?.twitter;
          case "linkedin": return b.socials?.linkedin;
          case "youtube":  return b.socials?.youtube;
          case "tiktok":   return b.socials?.tiktok;
          default:         return true;
        }
      });
    });
  }

  // Filter by min rating
  const minRating = parseFloat(state.filters.minRating) || 0;
  if (minRating > 0) {
    data = data.filter((b) => {
      const num = parseFloat(b.rating) || 0;
      if (num === 0 && b.rating === "N/A") return true;
      return num >= minRating;
    });
  }

  return data;
}

function renderRows() {
  el.resultsBody.innerHTML = "";
  const rows = getVisibleRowsData();
  rows.forEach((business, index) => renderRow(business, index));
  updateResultsCount();
}

function renderRow(business, index) {
  // Apply visibility filters
  const visible = getVisibleRowsData();
  if (!visible.some((b) => b.id === business.id)) {
    return;
  }

  // Check if already rendered
  if (el.resultsBody.querySelector(`[data-id="${business.id}"]`)) {
    return;
  }

  const isChecked = state.selectedIds.has(business.id);
  const row = document.createElement("tr");
  row.dataset.id = business.id;
  row.style.animationDelay = `${Math.min(index * 15, 200)}ms`;
  if (!isChecked) {
    row.classList.add("row-unchecked");
  }

  const socials = business.socials || {};
  const socialHtml = buildSocialBadges(socials);
  const ratingHtml = buildRatingDisplay(business.rating);
  const websiteHtml = business.hasWebsite && business.website
    ? `<a class="website-link" href="${escapeHtml(business.website)}" title="${escapeHtml(business.website)}" target="_blank">${truncateDomain(business.website)}</a>`
    : `<span class="badge-status badge-nowebsite">None</span>`;

  row.innerHTML = `
    <td><input type="checkbox" class="row-check" data-id="${business.id}" ${isChecked ? "checked" : ""} /></td>
    <td title="${escapeHtml(business.name)}">${truncate(business.name, 18)}</td>
    <td title="${escapeHtml(business.email || "N/A")}">${truncate(business.email || "", 16) || "—"}</td>
    <td>${ratingHtml}</td>
    <td>${websiteHtml}</td>
    <td title="${escapeHtml(business.phone || "N/A")}">${truncate(business.phone || "", 14) || "—"}</td>
    <td>${socialHtml}</td>
    <td>
      <button class="btn-view" data-url="${encodeURIComponent(business.mapsUrl || "")}" type="button">👁</button>
    </td>
  `;

  // Checkbox handler
  row.querySelector(".row-check").addEventListener("change", (event) => {
    const id = event.target.dataset.id;
    if (event.target.checked) {
      state.selectedIds.add(id);
      row.classList.remove("row-unchecked");
    } else {
      state.selectedIds.delete(id);
      row.classList.add("row-unchecked");
    }
    updateResultsCount();
  });

  // View button handler
  row.querySelector(".btn-view").addEventListener("click", async (event) => {
    const mapsUrl = decodeURIComponent(event.currentTarget.dataset.url || "");
    if (mapsUrl) {
      await chrome.tabs.create({ url: mapsUrl });
    }
  });

  el.resultsBody.appendChild(row);
}

function buildSocialBadges(socials) {
  const badges = [];
  if (socials.facebook) badges.push(`<a class="social-badge fb" href="${escapeHtml(socials.facebook)}" target="_blank" title="Facebook">f</a>`);
  if (socials.instagram) badges.push(`<a class="social-badge ig" href="${escapeHtml(socials.instagram)}" target="_blank" title="Instagram">📷</a>`);
  if (socials.twitter) badges.push(`<a class="social-badge tw" href="${escapeHtml(socials.twitter)}" target="_blank" title="Twitter/X">𝕏</a>`);
  if (socials.linkedin) badges.push(`<a class="social-badge li" href="${escapeHtml(socials.linkedin)}" target="_blank" title="LinkedIn">in</a>`);
  if (socials.youtube) badges.push(`<a class="social-badge yt" href="${escapeHtml(socials.youtube)}" target="_blank" title="YouTube">▶</a>`);
  if (socials.tiktok) badges.push(`<a class="social-badge tt" href="${escapeHtml(socials.tiktok)}" target="_blank" title="TikTok">♪</a>`);
  return badges.length > 0 ? `<div class="social-badges">${badges.join("")}</div>` : "—";
}

function buildRatingDisplay(rating) {
  const num = parseFloat(rating);
  if (isNaN(num) || rating === "N/A") {
    return `<span class="rating-num">—</span>`;
  }
  const fullStars = Math.floor(num);
  let stars = "";
  for (let i = 0; i < Math.min(fullStars, 5); i++) {
    stars += "★";
  }
  return `<span class="rating-display"><span class="rating-star">${stars}</span><span class="rating-num">${num}</span></span>`;
}

function truncateDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.length > 14 ? hostname.slice(0, 13) + "…" : hostname;
  } catch {
    return truncate(url, 14);
  }
}

function selectAll() {
  const visible = getVisibleRowsData();
  visible.forEach((b) => state.selectedIds.add(b.id));
  el.checkAllHeader.checked = true;
  el.resultsBody.querySelectorAll(".row-check").forEach((cb) => {
    cb.checked = true;
    cb.closest("tr")?.classList.remove("row-unchecked");
  });
  updateResultsCount();
}

function deselectAll() {
  state.selectedIds.clear();
  el.checkAllHeader.checked = false;
  el.resultsBody.querySelectorAll(".row-check").forEach((cb) => {
    cb.checked = false;
    cb.closest("tr")?.classList.add("row-unchecked");
  });
  updateResultsCount();
}

function updateResultsCount() {
  const visible = getVisibleRowsData();
  const selected = visible.filter((b) => state.selectedIds.has(b.id)).length;
  if (el.resultsCount) {
    el.resultsCount.textContent = `${selected} of ${visible.length} selected for export`;
  }
}

async function clearResults() {
  state.allBusinesses = [];
  state.selectedIds.clear();
  state.locations = [];
  state.currentLocationIndex = 0;
  renderRows();
  renderCounters();
  el.exportPanel.classList.add("hidden");
  el.statsBar.classList.add("hidden");
  el.resultsSection.classList.add("hidden");
  await LeadsForgeStorage.clearLeads();
  showStatus("idle", "Cleared all saved leads.");
}

async function persistLeads() {
  await LeadsForgeStorage.saveLeads(state.allBusinesses);
  await chrome.runtime.sendMessage({ type: "SAVE_LEADS", data: state.allBusinesses });
}

function getExportDataset() {
  const includeAllFields = el.exportAllFields.checked;
  const selected = state.allBusinesses.filter((b) => state.selectedIds.has(b.id));
  return { data: selected.length > 0 ? selected : state.allBusinesses, includeAllFields };
}

function handleExportExcel() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  LeadsForgeExporter.exportToExcel(data, "LeadsForge", includeAllFields);
  showStatus("success", `Exported ${data.length} leads to Excel.`);
}

function handleExportCSV() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  LeadsForgeExporter.exportToCSV(data, "LeadsForge", includeAllFields);
  showStatus("success", `Exported ${data.length} leads to CSV.`);
}

function handleExportSheets() {
  const { data, includeAllFields } = getExportDataset();
  if (!data.length) {
    showStatus("error", "No leads available to export.");
    return;
  }
  showStatus("scanning", "Preparing CSV and opening Google Sheets...");
  LeadsForgeExporter.exportToGoogleSheets(data, includeAllFields, (msg) => {
    showStatus("success", msg);
  });
}

function truncate(value, max) {
  if (!value || value.length <= max) {
    return value || "";
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
