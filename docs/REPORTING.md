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
5. GitHub opens with a **short summary** in **Description** (URLs cannot hold the full HTML report).
6. Click in **Description**, press **Ctrl+V** / **Cmd+V** to paste the **full report** from your clipboard (below the summary).
7. Describe what went wrong, then submit.

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
