# Risk cases and how to work with them

This document tracks known limitations and edge cases for the Moodle BGU PDF Downloader. Use it when something fails in production or when you want to extend test coverage later.

**Fixture available today:** section-only course page in [`resources/`](../resources/) (no folder activities). See [`resources/README.md`](../resources/README.md).

---

## Status overview

| Case | Risk | Covered by fixture? | Your action when needed |
|------|------|---------------------|-------------------------|
| [1. Moodle DOM drift](#1-moodle-dom-drift) | High | Partial (one course layout) | Add new HTML snapshots |
| [2. Section-only courses](#2-section-only-courses) | Low | Yes | Routine use; report mismatches |
| [3. Folder activities](#3-folder-activities) | Medium | No | Save folder page HTML when you get a course with folders |
| [4. Legacy file extensions](#4-legacy-file-extensions-doc-ppt) | Medium | Unknown in fixture | Test `.doc` / `.ppt` resources manually |
| [5. Resource redirect resolution](#5-resource-redirect-resolution) | Medium | Links present; fetch not in fixture | Manual download test + console logs |
| [6. Large courses / rate limiting](#6-large-courses--rate-limiting) | Low–Medium | Many sections in fixture | Stress-test on huge course |
| [7. Duplicate display names](#7-duplicate-display-names) | Low | Possible in fixture | Confirm `(2)` suffix in Downloads |
| [8. Text file type](#8-text-file-type-txtrtf) | Low | Not in fixture | Product decision |
| [9. Session / auth](#9-session--auth) | Medium | N/A (offline HTML) | Logged-out or expired session test |
| [10. Hebrew / special characters](#10-hebrew--special-characters-in-titles) | Low | Yes | UI + folder path check |

---

## 1. Moodle DOM drift

**What can go wrong:** BGU updates Moodle theme or markup; selectors stop matching → empty section list, missing files, or wrong section names.

**What the extension expects:**

| Purpose | Selector / pattern |
|---------|-------------------|
| Main scan area | `#page-content` (fallback: `document.body`) |
| Section blocks | `li.section.course-section` |
| Section title | `h3.sectionname` |
| Activities | `.activity-item` with `data-activityname` |
| File type icons | `img[src*="/f/"]` → moodle type from `/f/{type}-24` |
| Resource links | `a[href*="/mod/resource/view.php"]` |
| Direct files | `a[href*="/pluginfile.php/"]` |
| Folders | `a[href*="/mod/folder/view.php"]` |

**How to work with it (you):**

1. Save a fresh course HTML into `resources/` (see [resources/README.md](../resources/README.md)).
2. Note what broke (e.g. “sections list empty”).
3. Share the new file + one sentence; agent updates selectors and adds/updates tests.

**How to work with it (agent / CI):**

- Parse fixture in JSDOM; assert section count and resource link count.
- Run `npm test` after any selector change.

**Current fixture:** matches the table above; 15 sections, resources only.

---

## 2. Section-only courses

**What can go wrong:** Section filter uses titles from `getSectionTitle()`; if titles in the popup don’t match titles on links, downloads are filtered to zero.

**Mitigation already in code:** `getSectionTitle()` uses `li.section.course-section` + `h3.sectionname` everywhere for collection and file-type scanning.

**How to work with it (you):**

1. Open popup → confirm section names match Moodle headings.
2. Select **one** section → Scan & Download → only that section’s files should queue.
3. If “No files in selected sections” but files are visible on the page, report section name from UI vs page (screenshot or copy `h3.sectionname` text).

**How to work with it (agent):**

- Add fixture test: `collectSections()` list equals expected titles extracted once from HTML.

---

## 3. Folder activities

**What can go wrong:** Files inside a folder are not on the course page; extension must `fetch()` the folder page and parse `pluginfile.php` links. Extra failure modes: auth, 403, HTML change, concurrency.

**Your courses today:** no folders in the provided fixture — **not validated end-to-end**.

**How to work with it (you) — when you have a folder course:**

1. Save **two** files into `resources/`:
   - `course-view-….html` (with folder link visible)
   - `folder-view-….html` (opened folder activity, “Webpage, HTML only”)
2. Manually: select section with folder → download → confirm files appear under `Downloads/[Course]/[Section]/`.
3. Paste any `[Content] Folder fetch failed` lines from the course tab console.

**How to work with it (agent):**

- Implement fixture test for folder HTML using mocked `fetch` returning `folder-view-….html`.
- Tune `CONCURRENCY` (currently 3) if Moodle throttles.

---

## 4. Legacy file extensions (.doc / .ppt)

**What can go wrong:** User selects “Word” or “PowerPoint” but Moodle serves `.doc` or `.ppt`. Older code matched only `.docx` / `.pptx`.

**Mitigation:** `matchesFileTypes()` in `utils.js` uses alias extensions (`doc`, `ppt`, etc.).

**How to work with it (you):**

1. Find a course with at least one `.doc` or `.ppt` resource.
2. Enable that type in the popup → download.
3. If missing: note activity name + whether the file opens in browser (URL bar extension).

**How to work with it (agent):**

- Add unit tests only (already cover `.doc` / `.ppt` URLs).
- Optional: save HTML where `pluginfile.php` URL ends in `.doc` in `resources/`.

---

## 5. Resource redirect resolution

**What can go wrong:** Course page links point to `/mod/resource/view.php?id=…`. Extension `fetch()`es that URL and follows redirects to `pluginfile.php`. Failures: not logged in, redirect change, HTML embed instead of redirect.

**Fixture note:** snapshot contains `view.php` links but cannot test live `fetch` offline.

**How to work with it (you):**

1. On a live course tab, open DevTools → **Network**.
2. Click Scan & Download; watch requests to `view.php` and final `pluginfile.php`.
3. If downloads fail: copy status codes and whether `pluginfile.php` appears.

**How to work with it (agent):**

- Mock `fetch` in tests with 302 → `pluginfile.php` URL.
- Improve error message in popup when `resolveResourceLink` returns `[]`.

---

## 6. Large courses / rate limiting

**What can go wrong:** Many folders (or future parallel fetches) slow the tab or trigger Moodle rate limits.

**Your fixture:** many sections but no folder fetches — good for DOM size, not for network stress.

**How to work with it (you):**

- On the largest course you use: run full scan; note duration, freezes, or partial downloads.
- Report approximate: sections count, folder count, file count.

**How to work with it (agent):**

- Lower `CONCURRENCY` or add delay between folder fetches.
- Show progress in popup (future enhancement).

---

## 7. Duplicate display names

**What can go wrong:** Two activities in the same section share the same title → second file should become `Title (2).ext` via background `titleCounts`.

**Fixture note:** may contain duplicate `data-activityname` across sections (e.g. “תרגול 2 - exploits”) — different sections, so no collision. Same-section duplicates need live verification.

**How to work with it (you):**

1. Find same section, two resources with identical visible names.
2. Download both; check Downloads for `(2)` suffix.

**How to work with it (agent):**

- Unit test `queueDownloads` name disambiguation (not yet exported).
- Or export helper and test in Jest.

---

## 8. Text file type (.txt/.rtf)

**What can go wrong:** `FILE_TYPES.text` exists but `MOODLE_ICON_MAP.text` is `null`, so text rarely appears as a selectable type.

**How to work with it (you):**

- Decide: should TXT/RTF be downloadable?
- Tell the agent **yes** or **no**.

**How to work with it (agent):**

- **Yes:** set `MOODLE_ICON_MAP.text = 'text'`, add popup label, test.
- **No:** remove `text` from `FILE_TYPES` to avoid confusion.

---

## 9. Session / auth

**What can go wrong:** `fetch()` for folders/resources without valid session → empty results, 403, or login HTML instead of files.

**Mitigation:** `credentials: 'include'` on content-script fetches.

**How to work with it (you):**

1. Log out of Moodle (or use incognito without login).
2. Open course → extension → note message (empty vs error).
3. Repeat with expired session if you hit it naturally.

**How to work with it (agent):**

- Detect non-OK `response.status` and surface “Log in to Moodle” in popup (future).

---

## 10. Hebrew / special characters in titles

**What can go wrong:** Broken section dropdown, wrong download paths, or `querySelector` failures (mitigated by DOM APIs for checkboxes).

**Fixture:** Hebrew course title and section names; resources include `קובץ` in hidden accessibility spans.

**How to work with it (you):**

- Confirm popup shows Hebrew section names correctly.
- Confirm downloaded folder names under `Downloads/` are readable and not stripped/corrupted.

**How to work with it (agent):**

- Fixture test for `getResourceTitle()` stripping `קובץ` / `File` (already in `tests/content.test.js`).
- Optional: normalize Unicode for filesystem (if macOS reports issues).

---

## Quick manual test script (live Moodle)

Use when you want to sanity-check without diving into a specific case:

1. Load unpacked extension → open a course page.
2. Popup: sections populated, file types reflect selection.
3. **All sections** + PDF only → download; count files vs status line.
4. **One section** + PPTX → only that section’s slides.
5. Check `Downloads/[Course name]/[Section]/` layout.

---

## When you come back to the agent

Use a short template:

```text
Case: [number or name from this doc]
Course: [optional]
Fixture: [added file in resources/ or no]
Expected:
Actual:
Console: [paste [Content] / [Background] lines]
```

The agent should read this file + `resources/` before changing selectors or download logic.
