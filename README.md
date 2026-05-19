# Course Grabber — BGU Moodle

A browser extension to bulk download course materials (PDF, PowerPoint, Word, Excel) from [Ben-Gurion University Moodle](https://moodle.bgu.ac.il) with section and format filtering. All processing runs on your device.

## Features

- **Bulk download** — one scan, then filter and download
- **Section filtering** — all sections, specific units, or the visible section
- **Multi-format** — PDF, PPTX, DOCX, XLSX (auto-detected on the page)
- **Smart folders** — `Downloads/[Course]/[Section]/[File]`
- **Hebrew / English UI**
- **Privacy first** — no analytics, no external servers

## Installation

### Requirements

- **Chrome**, **Edge**, **Brave**, or **Vivaldi** (Chromium-based; Manifest V3)
- A BGU Moodle account and an active login on `moodle.bgu.ac.il`
- The extension folder from this repo (clone or download ZIP)

### Install from source (developer / unpacked)

1. **Get the code**
   ```bash
   git clone https://github.com/shpigelgi/moodle-bgu-pdf-downloader.git
   cd moodle-bgu-pdf-downloader
   ```
   Or download the repository as a ZIP and extract it.

2. **Open the extensions page**
   - **Chrome / Brave:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Vivaldi:** `vivaldi://extensions`

3. **Enable Developer mode** (toggle in the top-right or sidebar).

4. Click **Load unpacked** (Chrome/Brave/Edge) or **Load extension** (Vivaldi).

5. Select the **repository root folder** — the directory that contains `manifest.json` (not `src/` alone).

6. Pin the extension (optional): click the puzzle icon in the toolbar → pin **Course Grabber**.

7. **Open or refresh** your Moodle **course page** (`course/view.php?id=…`) so the content script loads. If the popup misbehaves after an update, reload the extension on the extensions page and refresh the course tab again.

### Publish to Chrome Web Store (optional)

Publishing is **not required** for personal use. If you list it publicly, Google charges a **one-time $5** [developer registration fee](https://developer.chrome.com/docs/webstore/register) per account. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for store listing requirements.

## Usage

1. Log in to Moodle and open a **course home page**:
   `https://moodle.bgu.ac.il/moodle/course/view.php?id=…`
2. Click the **Course Grabber** icon in the toolbar.
3. Wait for the initial scan (progress bar at the top). Format chips show what’s on the page (e.g. **PDF (8)**).
4. Choose **sections** and **formats** — the file list updates instantly (no re-scan).
5. Optionally set a **filename prefix** (e.g. `Unit3_`).
6. Review files under **Show files**, then click **Download**.
7. Files appear under your Chrome **Downloads** folder, organized by course and section.

Use **Rescan page** only if you added new materials on Moodle and need a fresh list.

**Language:** use **עברית** / **English** in the header (top-right).

## Privacy

This extension does **not**:

- Collect user data
- Send page content to third-party servers
- Use analytics or telemetry

Downloads go through the browser’s normal download API to your machine. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Permissions

| Permission | Why |
|------------|-----|
| `downloads` | Save files to your Downloads folder |
| `activeTab` | Read the current Moodle tab when you open the popup |
| `scripting` | Inject the scanner if the page opened before the extension |
| `storage` | Remember language and per-course preferences (sections, formats, prefix) |
| `moodle.bgu.ac.il` | Only this host — course pages and file URLs |

## Development

Vanilla JavaScript, no runtime npm dependencies in the extension bundle.

```bash
npm install   # optional — for tests only
npm test
```

### Project structure

```
pdf-downloader/
├── manifest.json
├── src/                 # popup, content script, background, utils
├── tests/               # Jest
├── resources/           # Saved Moodle HTML fixtures
├── docs/RISK_CASES.md
└── assets/              # Toolbar icons
```

- Fixtures: [resources/README.md](resources/README.md)
- Edge cases: [docs/RISK_CASES.md](docs/RISK_CASES.md)

## Contributing

Issues and pull requests are welcome. Please run `npm test` and verify on a real Moodle course page.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

Not affiliated with or endorsed by Ben-Gurion University. Use in line with university policies and course copyright rules.
