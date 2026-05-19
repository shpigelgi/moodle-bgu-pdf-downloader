var POPUP_STRINGS = {
  en: {
    formats: 'Formats',
    formatsHint: 'auto-detected on page',
    sections: 'Sections',
    allSections: 'All Sections',
    sectionsSelected: '{n} sections selected',
    sectionSearch: 'Search sections…',
    selectAll: 'All',
    clearAll: 'Clear',
    currentSection: 'Visible section',
    scan: 'Scan course',
    rescan: 'Rescan page',
    download: 'Download',
    downloadType: 'Download {type}',
    cancel: 'Cancel',
    openCourse: 'Focus course tab',
    openDownloads: 'Open Downloads folder',
    prefixLabel: 'Filename prefix',
    prefixPlaceholder: 'e.g. Unit3_',
    showFiles: 'Show files',
    hideFiles: 'Hide files',
    pathPreview: 'Example path',
    pathNote: 'Saved under your Chrome Downloads folder',
    lastScan: 'Last scan: {count} files, {time}',
    loading: 'Loading course…',
    ready: 'Finding files…',
    scanning: 'Scanning…',
    scanDone: '{summary}',
    noFiles: 'No matching files in selected sections.',
    downloading: 'Downloading…',
    downloadDone: '{ok} queued{failed}',
    authRequired: 'Sign in to Moodle on this course tab, then scan again.',
    wrongPageTitle: 'Open a Moodle course',
    wrongPageBody: 'Navigate to a course page on moodle.bgu.ac.il (course/view.php), then open this popup again.',
    openMoodle: 'Open Moodle',
    localeToggle: 'עברית',
    reportIssue: 'Report issue',
    reportPreparing: 'Collecting page details…',
    reportCopied: 'GitHub opened with the report in Description. Submit when ready.',
    reportClipboard: 'Full report also copied — paste into Description if the field is empty.',
    reportFailed: 'Could not copy. GitHub is open — paste with Ctrl+V / Cmd+V.',
    experimental: 'experimental'
  },
  he: {
    formats: 'פורמטים',
    formatsHint: 'זוהה אוטומטית בעמוד',
    sections: 'יחידות',
    allSections: 'כל היחידות',
    sectionsSelected: '{n} יחידות נבחרו',
    sectionSearch: 'חיפוש יחידות…',
    selectAll: 'הכל',
    clearAll: 'נקה',
    currentSection: 'יחידה גלויה',
    scan: 'סרוק קורס',
    rescan: 'סרוק שוב את העמוד',
    download: 'הורד',
    downloadType: 'הורד {type}',
    cancel: 'ביטול',
    openCourse: 'מעבר ללשונית הקורס',
    openDownloads: 'פתח תיקיית הורדות',
    prefixLabel: 'קידומת לשם קובץ',
    prefixPlaceholder: 'לדוגמה Unit3_',
    showFiles: 'הצג קבצים',
    hideFiles: 'הסתר קבצים',
    pathPreview: 'דוגמת נתיב',
    pathNote: 'נשמר בתיקיית ההורדות של Chrome',
    lastScan: 'סריקה אחרונה: {count} קבצים, {time}',
    loading: 'טוען קורס…',
    ready: 'מאתר קבצים…',
    scanning: 'סורק…',
    scanDone: '{summary}',
    noFiles: 'לא נמצאו קבצים ביחידות שנבחרו.',
    downloading: 'מוריד…',
    downloadDone: '{ok} בתור{failed}',
    authRequired: 'התחבר ל-Moodle בלשונית הקורס וסרוק שוב.',
    wrongPageTitle: 'פתח עמוד קורס Moodle',
    wrongPageBody: 'עבור לעמוד קורס ב-moodle.bgu.ac.il (course/view.php), ואז פתח שוב את התוסף.',
    openMoodle: 'פתח Moodle',
    localeToggle: 'English',
    reportIssue: 'דווח על תקלה',
    reportPreparing: 'אוסף פרטים מהעמוד…',
    reportCopied: 'GitHub נפתח עם הדוח בשדה Description. שלח כשמוכן.',
    reportClipboard: 'הדוח הועתק גם ללוח — הדבק ב-Description אם השדה ריק.',
    reportFailed: 'לא ניתן להעתיק. GitHub נפתח — הדבק ב-Ctrl+V / Cmd+V.',
    experimental: 'ניסיוני'
  }
};

var formatString = (template, vars) => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? vars[key] : ''));
};

if (typeof window !== 'undefined') {
  window.POPUP_STRINGS = POPUP_STRINGS;
  window.formatString = formatString;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { POPUP_STRINGS, formatString };
}
