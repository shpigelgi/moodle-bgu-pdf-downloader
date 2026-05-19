# Reporting bugs

If Course Grabber missed files, showed the wrong count, or failed on a course, please send a report so we can reproduce it.

## Fastest way (in the extension)

1. Open the extension on the **same Moodle course tab** where it failed.
2. Click **Report issue** (below the status message).
3. The extension collects:
   - Extension state (version, filters, scan counts, errors)
   - **List of files** the extension found (or missed)
   - **Activity inventory** per section (names + Moodle icon types)
   - **Sanitized HTML** of the course content area (scripts/styles removed; truncated if very large)
4. The full report is **copied to your clipboard** and GitHub opens in a new tab.
5. GitHub should open with the report already in the **Description** box. If it is empty, press **Ctrl+V** / **Cmd+V** (the full report is on your clipboard).
6. Add a short note at the top about what went wrong, then submit.

Nothing is uploaded automatically. You choose what to send.

## What we need

| Included automatically | Avoid |
|------------------------|--------|
| Course URL and ID | Passwords |
| Per-section activity list (names, types) | Unrelated personal data |
| Sanitized course page HTML | Downloaded file attachments |
| Extension scan results | |

The HTML lets maintainers debug Moodle layouts **without access to your course**.

## Without the extension

Open a [bug report](https://github.com/shpigelgi/moodle-bgu-pdf-downloader/issues/new?template=bug_report.yml) on GitHub and describe the course layout (folders, file types, Hebrew/English UI).

## Feature ideas

Use the [feature request template](https://github.com/shpigelgi/moodle-bgu-pdf-downloader/issues/new?template=feature_request.yml).
