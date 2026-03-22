<div align="center">

<img src="icons/icon.png" width="96" height="96" alt="LeadsForge Logo" />

# LeadsForge

### Google Maps Lead Scraper: Chrome and Firefox Extension

**Extract, filter, select, and export business leads from Google Maps with precision.**

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Firefox Add-on](https://img.shields.io/badge/Platform-Firefox%20Add--on-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://extensionworkshop.com/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-1a2332?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-2.0.0-2563EB?style=for-the-badge)](.)

</div>

---

## Overview

LeadsForge is a browser extension that scrapes business data from Google Maps search results. It supports advanced filtering, multi-location scanning, individual business selection, and one-click export to Excel, CSV, or Google Sheets.

Whether you are a freelancer prospecting for web design clients, a sales professional building outreach lists, or a marketing agency qualifying leads: LeadsForge streamlines the entire process from search to structured data.

---

## Features

| Feature                         | Description                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| **Website Filter**              | Filter businesses by availability: all, with website, or without website                     |
| **Rating Filter**               | Set a minimum star rating (0 to 5) to include only quality-rated businesses                  |
| **Closed Business Detection**   | Automatically identifies and excludes permanently or temporarily closed businesses            |
| **Business Selection**          | Select individual businesses via checkboxes before exporting: pick exactly the leads you need |
| **Multi-Location Scanning**     | Enter multiple search queries and scan them all sequentially                                  |
| **Deep Scan Mode**              | Clicks into each business listing for detailed data: phone, email, social links, hours        |
| **Social Media Extraction**     | Captures Facebook, Instagram, Twitter/X, LinkedIn, YouTube, and TikTok links (Deep Scan)     |
| **Rich Results Table**          | Live results displayed in a clean table with ratings, social badges, and website links        |
| **Multi-Format Export**         | Export to Excel (.xlsx), CSV, or open Google Sheets directly                                  |
| **Persistent Storage**          | Leads are saved locally: reopen the popup and your data is still there                       |

---

## Installation

### Google Chrome (Developer Mode)

1. Download or clone this repository to your local machine.

2. Libraries are pre-included in the `libs/` directory:
   - `libs/xlsx.full.min.js`: SheetJS for Excel export
   - `libs/papaparse.min.js`: PapaParse for CSV export

3. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```

4. Enable **Developer mode** using the toggle in the top-right corner.

5. Click **Load unpacked**.

6. Select the `Leadforge` project folder.

7. Pin the extension to your toolbar for quick access.

### Mozilla Firefox (Developer Edition or Nightly)

1. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```

2. Click **Load Temporary Add-on**.

3. Select the `manifest.json` file inside the `Leadforge` folder.

4. The extension will appear in your toolbar and is ready to use.

> **Note:** The manifest includes `browser_specific_settings` with a placeholder ID (`leadsforge@envy.xyz`) for Firefox compatibility.

### Updating Bundled Libraries (Optional)

To update the bundled libraries to their latest versions:
- SheetJS: download from `https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js` and save as `libs/xlsx.full.min.js`
- PapaParse: download from `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js` and save as `libs/papaparse.min.js`

---

## Usage Guide

### Quick Start (Single Location)

1. Open Google Maps in your browser.
2. Search for a business type and location (for example: "restaurants in Austin, TX").
3. Click the LeadsForge extension icon in your toolbar.
4. Configure your filters:
   - **Website Filter:** Choose "All Businesses", "Without Website", or "With Website"
   - **Min Rating:** Slide to set a minimum star rating
   - **Exclude Closed:** Toggle on to automatically remove closed businesses
   - **Deep Scan:** Enable for detailed data (phone, email, socials): takes longer
   - **Scroll Depth:** Control how many pages of results to load (1x to 5x)
5. Click **Start Scan**.
6. Watch the live results populate in the table.
7. Use checkboxes to select or deselect specific businesses.
8. Export your selected leads via Excel, CSV, or Google Sheets.

### Multi-Location Scanning

1. In the Locations field, enter multiple search queries separated by commas, semicolons, or new lines:
   ```
   plumbers in Chicago, plumbers in Miami, plumbers in Los Angeles
   ```
2. Click **Start Scan**.
3. LeadsForge will automatically navigate to each location, scan, and aggregate all results.
4. After all locations are processed, select and export your combined leads.

### Understanding the Results Table

| Column      | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| Checkbox    | Select or deselect the business for export                                  |
| Business    | Business name                                                               |
| Email       | Business email address (if detected)                                        |
| Rating      | Star rating with visual indicator                                           |
| Website     | Clickable website link, or "None" if no website is found                    |
| Phone       | Phone number                                                                |
| Socials     | Clickable badges for Facebook, Instagram, Twitter/X, LinkedIn, YouTube, TikTok |

### Export Options

- **Excel (.xlsx):** Full spreadsheet with formatted headers and all data columns
- **CSV:** Universal format compatible with any spreadsheet application
- **Google Sheets:** Downloads CSV and opens a new Google Sheets tab for import

The "Include all fields" checkbox controls whether the export includes extended data (hours, price range, plus code) or just the essential columns.

---

## Technical Architecture

```
Leadforge/
├── manifest.json          # Chrome/Firefox Extension Manifest V3 configuration
├── popup.html             # Extension popup UI structure
├── popup.css              # Light theme styling with premium design language
├── popup.js               # Popup logic: filters, scanning, selection, export
├── content.js             # Injected scraper: DOM parsing, data extraction, social detection
├── background.js          # Service worker: chunked storage, tab navigation
├── utils/
│   ├── storage.js         # Chrome storage abstraction with caching
│   ├── exporter.js        # Excel, CSV, and Google Sheets export handlers
│   └── scraper.js         # Shared scraper utility functions
├── libs/
│   ├── xlsx.full.min.js   # SheetJS library for Excel generation
│   └── papaparse.min.js   # PapaParse library for CSV generation
└── icons/
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### How It Works

1. **Content Script** (`content.js`): Injected into Google Maps pages. Scrolls the results feed, extracts business data from DOM elements, and optionally performs deep scans by clicking into each listing for detailed information including phone, email, and social links.

2. **Popup** (`popup.js` and `popup.html`): Manages the UI, filter state, multi-location queue, business selection, and export triggers. Communicates with the content script via Chrome message passing.

3. **Background Service Worker** (`background.js`): Handles persistent storage with chunked writes to stay within `chrome.storage.local` limits and supports tab navigation for multi-location scanning.

---

## Configuration

| Setting           | Default     | Description                                                       |
| ----------------- | ----------- | ----------------------------------------------------------------- |
| Website Filter    | All         | Filter by website availability: All, With, or Without             |
| Min Rating        | Any (0)     | Minimum star rating threshold (0 to 5, in 0.5 increments)         |
| Exclude Closed    | Enabled     | Hide businesses flagged as temporarily or permanently closed       |
| Deep Scan         | Disabled    | Click into each listing for full details (slower but richer data)  |
| Scroll Depth      | 3x          | Number of scroll iterations to load more results                  |

All settings are automatically saved and restored between sessions.

---

## Troubleshooting

| Issue                                      | Solution                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| "Not on Google Maps" error                 | Ensure you are on `google.com/maps` with search results visible                                |
| No results found                           | Increase the Scroll Depth slider, or verify the search has visible results                     |
| Missing phone, email, or socials           | Enable Deep Scan mode: card-level data is limited                                              |
| Extension not appearing                    | Navigate to `chrome://extensions/`, ensure Developer Mode is on, and the extension is enabled  |
| Export button not working                  | Verify that `libs/xlsx.full.min.js` and `libs/papaparse.min.js` exist in the `libs/` folder    |
| Scan appears to hang                       | Google Maps may have rate-limited requests. Wait a moment and retry with a lower scroll depth   |

---

## Data Fields Captured

| Field            | Source         | Description                               |
| ---------------- | -------------- | ----------------------------------------- |
| Business Name    | Card / Detail  | Official business name                    |
| Category         | Card           | Business type (Restaurant, Plumber, etc.) |
| Phone            | Card / Detail  | Primary phone number                      |
| Email            | Card / Detail  | Email address (if visible on Maps)        |
| Address          | Card           | Street address                            |
| Rating           | Card           | Star rating (1.0 to 5.0)                  |
| Total Reviews    | Card           | Number of Google reviews                  |
| Website          | Card / Detail  | Business website URL                      |
| Facebook         | Detail         | Facebook page URL                         |
| Instagram        | Detail         | Instagram profile URL                     |
| Twitter / X      | Detail         | Twitter or X profile URL                  |
| LinkedIn         | Detail         | LinkedIn company or profile URL           |
| YouTube          | Detail         | YouTube channel URL                       |
| TikTok           | Detail         | TikTok profile URL                        |
| Business Hours   | Detail         | Operating hours                           |
| Price Range      | Detail         | Price tier indicator                       |
| Open Status      | Card / Detail  | Open or Possibly Closed                   |
| Google Maps URL  | Card           | Direct link to the Maps listing           |

---

## Disclaimer

This extension is provided for educational and personal use only. Automated scraping of Google Maps may violate Google's Terms of Service. Use responsibly and at your own risk. The developers are not responsible for any consequences arising from the use of this tool.

---

<div align="center">

**Built by LeadsForge**

</div>
