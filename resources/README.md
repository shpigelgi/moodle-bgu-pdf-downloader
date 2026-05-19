# Moodle HTML fixtures

Saved course pages used for **offline DOM testing** and documentation. No login required once saved.

## Current fixtures

| File | Shape | Notes |
|------|--------|--------|
| `קורס_ אבטחת מחשבים ורשתות תקשורת סמ 2 _ דף הבית.html` | **Sections only** (no folders) | BGU Moodle course view; ~15 sections; PDF + PowerPoint via `/mod/resource/view.php`; Hebrew section titles; `h3.sectionname` + `.activity-item` layout |

Confirmed in this snapshot:

- `li.section.course-section` with `h3.sectionname`
- Resources: `a[href*="/mod/resource/view.php"]` (not direct `pluginfile.php` on the course page)
- Icons: `/f/pdf-24`, `/f/powerpoint-24` (Moodle theme path)
- No `mod/folder/view.php` links

## Adding a new fixture

1. Open the Moodle page while logged in.
2. **Course view:** Save as “Webpage, HTML only” from the course home URL (`course/view.php?id=...`).
3. **Folder view** (when you have one): open the folder activity, then save that page the same way.
4. Drop the file in this directory (keep the name descriptive).
5. Tell the agent (or open an issue) which scenario it covers — see [docs/RISK_CASES.md](../docs/RISK_CASES.md).

Prefer saving **after** expanding all sections on the page so hidden activities appear in the HTML.

## Using fixtures in development

Automated tests are not wired to these files yet. Planned use:

- Load HTML in JSDOM with `#page-content` as `document` body context
- Run `collectSections`, `getAvailableFileTypesInSections`, and link collection against the fixture
- Compare counts/section names to a checked-in expectation file

Until then, fixtures support manual review and agent-assisted debugging without live Moodle access.
