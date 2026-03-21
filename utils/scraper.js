// Utility helpers reserved for future scraper expansion.
// The active runtime scraper lives in content.js due to Google Maps page-context requirements.

const MapLeadsScraperUtils = (() => {
  function dedupeBusinesses(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const key = `${item?.name || ""}|${item?.address || ""}|${item?.mapsUrl || ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function hasWebsiteByRules(item) {
    const website = item?.website || "";
    return Boolean(website && website !== "N/A");
  }

  return {
    dedupeBusinesses,
    hasWebsiteByRules
  };
})();
