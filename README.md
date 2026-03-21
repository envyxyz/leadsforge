## Installation (Developer Mode)

1. Download all extension files.
2. Libraries are already included in this build:
   - `libs/xlsx.full.min.js`
   - `libs/papaparse.min.js`
3. (Optional) Re-download latest free libraries if you want to update versions:
   - SheetJS: https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js  
     Save as: `libs/xlsx.full.min.js`
   - PapaParse: https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js  
     Save as: `libs/papaparse.min.js`
4. Open Chrome and go to `chrome://extensions/`.
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the `MapLeads-Pro` folder.
8. Pin the extension to your toolbar.

## Usage

1. Go to `google.com/maps`.
2. Search for a business type and city (example: `plumbers in Chicago`).
3. Click the MapLeads Pro icon.
4. Click **Start Scan**.
5. Export your leads to Excel, CSV, or Google Sheets.

## Notes

- Scraping selectors in Google Maps can change over time. `content.js` includes fallback selectors for old and new layouts.
- Deep Scan mode adds random delays (1.5s to 3.5s) to reduce aggressive click patterns.
- Large lead sets are chunked in storage to stay under `chrome.storage.local` limits.
- `libs/xlsx.full.min.js` and `libs/papaparse.min.js` are required for export buttons.
