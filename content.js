(() => {
  const SCAN_STATE = {
    running: false,
    stopRequested: false,
    filters: {
      noWebsiteOnly: true,
      includeClosedBusinesses: false,
      deepScan: false,
      scrollDepth: 3
    },
    seenIds: new Set()
  };

  const CARD_SELECTORS = [
    "[role='feed'] [role='article']",
    "[role='feed'] .Nv2PK",
    "[role='feed'] a.hfpxzc"
  ];

  const END_RESULT_SELECTORS = [
    ".HlvSq",
    "span:has-text('You've reached the end of the list')",
    "[aria-label*='end of list' i]"
  ];

  const MORE_RESULTS_SELECTORS = [
    "button[aria-label*='More results' i]",
    "button[jsaction*='pane.paginationSection.nextPage']",
    "a[aria-label*='More results' i]"
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomDelay(min = 1500, max = 3500) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function extractEmailsFromText(text) {
    if (!text) {
      return [];
    }
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set((text.match(emailRegex) || []).map((email) => email.trim()))];
  }

  function extractPhoneFromText(text) {
    if (!text) {
      return null;
    }
    const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g;
    const matches = text.match(phoneRegex) || [];
    const normalized = matches
      .map((value) => value.trim())
      .find((value) => value.replace(/\D/g, "").length >= 7);
    return normalized || null;
  }

  function isGoogleMapsSearchPage() {
    const url = window.location.href;
    const hasSearchUrl = url.includes("/maps/search/") || url.includes("/maps?q=") || url.includes("/maps/place/");
    const hasFeed = !!document.querySelector("[role='feed']");
    return hasSearchUrl || hasFeed;
  }

  function getFeedContainer() {
    return (
      document.querySelector("[role='feed']") ||
      document.querySelector("div[aria-label*='Results for' i]") ||
      document.querySelector(".m6QErb[aria-label]")
    );
  }

  function queryBySelectors(root, selectors) {
    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function queryText(root, selectors, defaultValue = "N/A") {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    return defaultValue;
  }

  function getCardElements() {
    const feed = getFeedContainer() || document;
    const cards = [];

    for (const selector of CARD_SELECTORS) {
      feed.querySelectorAll(selector).forEach((item) => cards.push(item));
      if (cards.length > 0) {
        break;
      }
    }

    // Ensure uniqueness across mixed selector matches.
    return [...new Set(cards)].filter((card) => card instanceof HTMLElement);
  }

  async function autoScroll(container, depth) {
    if (!container) {
      return;
    }

    for (let i = 0; i < depth; i += 1) {
      if (SCAN_STATE.stopRequested) {
        break;
      }

      container.scrollTop = container.scrollHeight;
      await sleep(randomDelay(1500, 3000));

      await clickMoreResultsIfPresent();

      if (hasReachedEnd()) {
        break;
      }

      chrome.runtime.sendMessage({
        type: "SCAN_PROGRESS",
        percent: Math.round(((i + 1) / depth) * 25),
        stage: `Loading more results (${i + 1}/${depth})...`
      });
    }
  }

  function hasReachedEnd() {
    for (const selector of END_RESULT_SELECTORS) {
      if (selector.includes(":has-text")) {
        continue;
      }
      if (document.querySelector(selector)) {
        return true;
      }
    }

    const bodyText = document.body?.innerText || "";
    return /you'?ve reached the end of the list/i.test(bodyText);
  }

  async function clickMoreResultsIfPresent() {
    for (const selector of MORE_RESULTS_SELECTORS) {
      const button = document.querySelector(selector);
      if (button && button instanceof HTMLElement) {
        button.click();
        await sleep(randomDelay(1000, 2200));
        return true;
      }
    }
    return false;
  }

  function extractWebsiteFromCard(cardElement) {
    const websiteEl =
      cardElement.querySelector("a[data-value='Website']") ||
      cardElement.querySelector("a[aria-label*='website' i]") ||
      cardElement.querySelector("a[href^='http']:not([href*='google'])");

    if (websiteEl?.href) {
      return websiteEl.href;
    }

    const domainMatch = (cardElement.innerText || "")
      .match(/\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|io|co|biz|info|app|dev)\b/g)
      ?.find((candidate) => !/google|g\.co|maps/i.test(candidate));

    return domainMatch ? (domainMatch.startsWith("http") ? domainMatch : `https://${domainMatch}`) : null;
  }

  function parseBooleanOpenState(text) {
    if (!text) {
      return true;
    }
    if (/permanently closed|closed/i.test(text)) {
      return false;
    }
    if (/open|opens/i.test(text)) {
      return true;
    }
    return true;
  }

  function extractDataFromCard(cardElement) {
    const business = {
      id: generateId(),
      name: "Unknown",
      category: "N/A",
      phone: "N/A",
      email: "N/A",
      address: "N/A",
      website: null,
      hasWebsite: false,
      rating: "N/A",
      reviews: "0",
      hours: "N/A",
      priceRange: "N/A",
      isOpen: true,
      plusCode: "N/A",
      mapsUrl: "",
      scrapedAt: new Date().toISOString()
    };

    try {
      business.name = queryText(cardElement, [
        ".qBF1Pd",
        ".fontHeadlineSmall",
        "h3",
        "[aria-label] .fontBodyMedium"
      ], "Unknown");

      business.rating = queryText(cardElement, [".MW4etd", "span[aria-label*='stars' i]", ".fontBodySmall span"], "N/A");
      business.reviews = queryText(cardElement, [".UY7F9", "span[aria-label*='reviews' i]", ".fontBodySmall:last-child"], "0").replace(/[()]/g, "");

      business.category = queryText(cardElement, [
        ".W4Efsd span:first-child",
        ".W4Efsd .fontBodyMedium",
        ".fontBodyMedium > span:first-child"
      ], "N/A");

      const infoCandidates = cardElement.querySelectorAll(".W4Efsd, .fontBodyMedium, .fontBodySmall");
      if (infoCandidates.length > 0) {
        const parts = [...infoCandidates]
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .filter((item) => item.length > 3);
        const likelyAddress = parts.find((line) => /\d+\s+|street|st\b|avenue|ave\b|road|rd\b|suite|city|zip/i.test(line));
        business.address = likelyAddress || parts[parts.length - 1] || "N/A";
      }

      const phoneFromCard = extractPhoneFromText(cardElement.innerText || "");
      business.phone = phoneFromCard || "N/A";

      business.website = extractWebsiteFromCard(cardElement);
      business.hasWebsite = !!business.website;

      const link =
        cardElement.querySelector("a.hfpxzc") ||
        cardElement.querySelector("a[href*='/maps/place']") ||
        cardElement.querySelector("a[href*='/maps/search']") ||
        cardElement.querySelector("a[href*='google.com/maps']");
      business.mapsUrl = link?.href || "";

      const statusText = queryText(cardElement, [
        ".W4Efsd:last-child",
        ".fontBodySmall",
        "span[aria-label*='open' i]"
      ], "");
      business.isOpen = parseBooleanOpenState(statusText);

      const detectedEmails = extractEmailsFromText(cardElement.innerText || "");
      if (detectedEmails.length > 0) {
        business.email = detectedEmails[0];
      }
    } catch (error) {
      console.warn("MapLeads: Failed card extraction", error);
    }

    return business;
  }

  async function deepScanCard(cardElement) {
    const detailData = {
      phone: null,
      website: null,
      email: "N/A",
      hours: "N/A",
      priceRange: "N/A",
      plusCode: "N/A",
      descriptionDomainWebsite: null,
      isOpen: null
    };

    try {
      const clickable =
        cardElement.querySelector("a.hfpxzc") ||
        cardElement.querySelector("a[href*='/maps/place']") ||
        cardElement;

      if (clickable instanceof HTMLElement) {
        clickable.click();
      }

      await sleep(randomDelay(1500, 3500));

      const panel =
        document.querySelector("[role='main']") ||
        document.querySelector(".m6QErb[role='main']") ||
        document.querySelector(".m6QErb.DxyBCb");

      if (!panel) {
        return detailData;
      }

      detailData.phone =
        queryText(panel, [
          "button[data-item-id*='phone']",
          "a[data-item-id*='phone']",
          "[aria-label*='Phone:' i]"
        ], "") || extractPhoneFromText(panel.innerText || "");

      const websiteEl =
        queryBySelectors(panel, [
          "a[data-item-id*='authority']",
          "a[aria-label*='Website' i]",
          "button[data-item-id*='authority'] a"
        ]) ||
        panel.querySelector("a[href^='http']:not([href*='google'])");

      detailData.website = websiteEl?.href || websiteEl?.textContent?.trim() || null;

      const panelText = panel.innerText || "";
      const emails = extractEmailsFromText(panelText);
      detailData.email = emails[0] || "N/A";

      detailData.hours = queryText(panel, [
        ".t39EBf",
        "[aria-label*='Hours' i]",
        "table[aria-label*='Hours' i]"
      ], "N/A");

      detailData.priceRange = queryText(panel, [
        ".mgr77e",
        "span[aria-label*='Price' i]",
        "[aria-label*='price range' i]"
      ], "N/A");

      detailData.plusCode = queryText(panel, [
        ".CsEnBe",
        "button[data-item-id*='oloc']",
        "[aria-label*='Plus code' i]"
      ], "N/A");

      const domainFromDescription = panelText
        .match(/\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|io|co|biz|info|app|dev)\b/g)
        ?.find((candidate) => !/google|g\.co|maps/i.test(candidate));
      detailData.descriptionDomainWebsite = domainFromDescription || null;

      detailData.isOpen = parseBooleanOpenState(panelText);
    } catch (error) {
      console.warn("MapLeads: Deep scan failed", error);
    }

    return detailData;
  }

  async function scrapeAllVisibleCards() {
    const cards = getCardElements();
    const businesses = [];

    for (const card of cards) {
      if (SCAN_STATE.stopRequested) {
        break;
      }

      try {
        const baseData = extractDataFromCard(card);
        businesses.push(baseData);
      } catch (error) {
        console.warn("MapLeads: Card scrape error", error);
      }
    }

    return businesses;
  }

  function filterBusinesses(arr, filters) {
    let results = [...arr];

    if (!filters.includeClosedBusinesses) {
      results = results.filter((business) => business.isOpen !== false);
    }

    if (filters.noWebsiteOnly) {
      results = results.filter((business) => !business.hasWebsite);
    }

    return results;
  }

  async function runScan(filters) {
    if (SCAN_STATE.running) {
      chrome.runtime.sendMessage({ type: "SCAN_ERROR", error: "Scan already running." });
      return;
    }

    if (!isGoogleMapsSearchPage()) {
      chrome.runtime.sendMessage({
        type: "SCAN_ERROR",
        error: "Please open a Google Maps search results page before scanning."
      });
      return;
    }

    SCAN_STATE.running = true;
    SCAN_STATE.stopRequested = false;
    SCAN_STATE.filters = { ...SCAN_STATE.filters, ...(filters || {}) };
    SCAN_STATE.seenIds.clear();

    const allBusinesses = [];

    try {
      const feed = getFeedContainer();
      if (!feed) {
        throw new Error("Could not locate results list on this Google Maps page.");
      }

      chrome.runtime.sendMessage({
        type: "SCAN_PROGRESS",
        percent: 5,
        stage: "Preparing scan..."
      });

      await autoScroll(feed, Number(SCAN_STATE.filters.scrollDepth) || 3);

      const cards = getCardElements();
      const totalCards = cards.length;

      for (let i = 0; i < cards.length; i += 1) {
        if (SCAN_STATE.stopRequested) {
          break;
        }

        const card = cards[i];

        try {
          const baseData = extractDataFromCard(card);
          const dedupeKey = `${baseData.name}|${baseData.address}|${baseData.mapsUrl}`;

          if (SCAN_STATE.seenIds.has(dedupeKey)) {
            continue;
          }

          SCAN_STATE.seenIds.add(dedupeKey);

          if (SCAN_STATE.filters.deepScan) {
            const deepData = await deepScanCard(card);
            baseData.phone = deepData.phone || baseData.phone || "N/A";
            baseData.website = deepData.website || baseData.website || deepData.descriptionDomainWebsite || null;
            baseData.email = deepData.email || baseData.email || "N/A";
            baseData.hours = deepData.hours || baseData.hours;
            baseData.priceRange = deepData.priceRange || baseData.priceRange;
            baseData.plusCode = deepData.plusCode || baseData.plusCode;
            if (typeof deepData.isOpen === "boolean") {
              baseData.isOpen = deepData.isOpen;
            }
          }

          // Final website detection: card website OR detail website OR detected domain in text.
          const inferredDomain = (card.innerText || "")
            .match(/\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|io|co|biz|info|app|dev)\b/g)
            ?.find((candidate) => !/google|g\.co|maps/i.test(candidate));
          const finalWebsite = baseData.website || inferredDomain || null;

          baseData.website = finalWebsite;
          baseData.hasWebsite = !!finalWebsite;

          allBusinesses.push(baseData);

          chrome.runtime.sendMessage({
            type: "LEAD_FOUND",
            data: baseData
          });

          const processedPercent = Math.round(((i + 1) / Math.max(totalCards, 1)) * 75) + 25;
          chrome.runtime.sendMessage({
            type: "SCAN_PROGRESS",
            percent: Math.min(99, processedPercent),
            stage: `Scanning listing ${i + 1} / ${totalCards}`
          });

          if (SCAN_STATE.filters.deepScan) {
            await sleep(randomDelay(1500, 3500));
          }
        } catch (cardError) {
          console.warn("MapLeads: card processing failed, skipping", cardError);
        }
      }

      const filtered = filterBusinesses(allBusinesses, SCAN_STATE.filters);

      if (SCAN_STATE.stopRequested) {
        chrome.runtime.sendMessage({
          type: "SCAN_STOPPED",
          total: allBusinesses.length,
          leads: filtered.length
        });
      } else {
        chrome.runtime.sendMessage({
          type: "SCAN_COMPLETE",
          total: allBusinesses.length,
          leads: filtered.length
        });
      }
    } catch (error) {
      chrome.runtime.sendMessage({
        type: "SCAN_ERROR",
        error: error.message || "Unexpected scan failure"
      });
    } finally {
      SCAN_STATE.running = false;
      SCAN_STATE.stopRequested = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "PING_MAPLEADS") {
      sendResponse({ ok: true, pageReady: isGoogleMapsSearchPage() });
      return;
    }

    if (message.type === "START_SCAN") {
      runScan(message.filters || {});
      sendResponse({ started: true });
      return true;
    }

    if (message.type === "STOP_SCAN") {
      SCAN_STATE.stopRequested = true;
      sendResponse({ stopping: true });
      return;
    }

    if (message.type === "SCRAPE_VISIBLE_ONLY") {
      scrapeAllVisibleCards()
        .then((businesses) => sendResponse({ businesses }))
        .catch((error) => sendResponse({ error: error.message }));
      return true;
    }
  });
})();
