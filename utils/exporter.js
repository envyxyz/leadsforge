const LeadsForgeExporter = (() => {
  function normalizeRows(data, includeAllFields = true) {
    const baseRows = (Array.isArray(data) ? data : []).map((b) => {
      const socials = b.socials || {};
      const socialLinks = [
        socials.facebook,
        socials.instagram,
        socials.twitter,
        socials.linkedin,
        socials.youtube,
        socials.tiktok
      ].filter(Boolean).join(", ");

      return {
        "Business Name": b.name || "N/A",
        Category: b.category || "N/A",
        Phone: b.phone || "N/A",
        Email: b.email || "N/A",
        Address: b.address || "N/A",
        Rating: b.rating || "N/A",
        "Total Reviews": b.reviews || "0",
        Website: b.website || "",
        Facebook: socials.facebook || "",
        Instagram: socials.instagram || "",
        "Twitter / X": socials.twitter || "",
        LinkedIn: socials.linkedin || "",
        YouTube: socials.youtube || "",
        TikTok: socials.tiktok || "",
        "Social Links": socialLinks || "",
        "Business Hours": b.hours || "N/A",
        "Price Range": b.priceRange || "N/A",
        "Plus Code": b.plusCode || "N/A",
        "Open Status": b.isPossiblyClosed ? "Possibly Closed" : b.isOpen === false ? "Closed" : "Open",
        "Google Maps URL": b.mapsUrl || "",
        "Scraped At": b.scrapedAt || ""
      };
    });

    if (includeAllFields) {
      return baseRows;
    }

    return baseRows.map((row) => ({
      "Business Name": row["Business Name"],
      Category: row.Category,
      Phone: row.Phone,
      Email: row.Email,
      Rating: row.Rating,
      Website: row.Website,
      Facebook: row.Facebook,
      Instagram: row.Instagram,
      "Twitter / X": row["Twitter / X"],
      LinkedIn: row.LinkedIn,
      "Google Maps URL": row["Google Maps URL"]
    }));
  }

  function fileStamp(prefix, ext) {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${prefix}_${timestamp}.${ext}`;
  }

  function exportToExcel(data, filenamePrefix = "LeadsForge", includeAllFields = true) {
    if (typeof XLSX === "undefined") {
      throw new Error("SheetJS library not found. Add libs/xlsx.full.min.js");
    }

    const rows = normalizeRows(data, includeAllFields);
    const worksheet = XLSX.utils.json_to_sheet(rows);

    if (worksheet["!ref"]) {
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const address = XLSX.utils.encode_cell({ r: 0, c });
        if (!worksheet[address]) {
          continue;
        }
        worksheet[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "0A0E1A" } }
        };
      }
    }

    const cols = Object.keys(rows[0] || {}).map(() => ({ wch: 24 }));
    worksheet["!cols"] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, fileStamp(filenamePrefix, "xlsx"));
  }

  function exportToCSV(data, filenamePrefix = "LeadsForge", includeAllFields = true) {
    if (typeof Papa === "undefined") {
      throw new Error("PapaParse library not found. Add libs/papaparse.min.js");
    }

    const rows = normalizeRows(data, includeAllFields);
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download(
      {
        url,
        filename: fileStamp(filenamePrefix, "csv")
      },
      () => {
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    );
  }

  function exportToGoogleSheets(data, includeAllFields = true, onReady = null) {
    exportToCSV(data, "LeadsForge", includeAllFields);
    setTimeout(() => {
      chrome.tabs.create({ url: "https://sheets.new" });
      if (typeof onReady === "function") {
        onReady("Google Sheets opened! Import the CSV via File > Import.");
      }
    }, 900);
  }

  return {
    exportToExcel,
    exportToCSV,
    exportToGoogleSheets
  };
})();
