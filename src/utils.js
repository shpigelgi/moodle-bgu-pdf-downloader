// centralized file type definitions
// This file is designed to be loaded:
// 1. In Content Scripts (via manifest.json)
// 2. In Popup (via <script> tag)
// 3. In Background Service Worker (via importScripts)

var FILE_TYPES = {
    'pdf': {
        extensions: ['pdf'],
        label: 'PDF',
        labelHe: 'PDF',
        moodleIcon: 'pdf'
    },
    'pptx': {
        extensions: ['pptx', 'ppt'],
        label: 'PowerPoint',
        labelHe: 'PowerPoint',
        moodleIcon: 'powerpoint'
    },
    'docx': {
        extensions: ['docx', 'doc'],
        label: 'Word',
        labelHe: 'Word',
        moodleIcon: 'document'
    },
    'xlsx': {
        extensions: ['xlsx', 'xls', 'csv'],
        label: 'Excel',
        labelHe: 'Excel',
        moodleIcon: 'spreadsheet'
    },
    'text': {
        extensions: ['txt', 'rtf'],
        label: 'Text',
        labelHe: 'טקסט',
        moodleIcon: 'text'
    }
};

var MOODLE_ICON_MAP = {
    'pdf': 'pdf',
    'powerpoint': 'pptx',
    'document': 'docx',
    'spreadsheet': 'xlsx',
    'text': null,
    'archive': null
};

var sanitizeForFolder = (name) => {
    if (!name || typeof name !== 'string') {
        return "Unknown";
    }
    const sanitized = name
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return sanitized || "Unknown";
};

var getCourseIdFromUrl = (url) => {
    if (!url) return null;
    try {
        return new URL(url).searchParams.get('id');
    } catch (e) {
        return null;
    }
};

var getTypeForUrl = (url) => {
    if (!url || typeof FILE_TYPES === 'undefined') return null;
    for (const [type, config] of Object.entries(FILE_TYPES)) {
        if (config.extensions && matchesFileTypes(url, [type])) {
            return type;
        }
    }
    return null;
};

var countByType = (links) => {
    const counts = {};
    if (!Array.isArray(links)) return counts;
    links.forEach((link) => {
        const type = getTypeForUrl(link.url);
        if (type) {
            counts[type] = (counts[type] || 0) + 1;
        }
    });
    return counts;
};

var buildDownloadPath = (courseTitle, section, filename) => {
    const coursePath = sanitizeForFolder(courseTitle || "Moodle Course");
    const sectionPath = sanitizeForFolder(section || "General");
    const safeName = sanitizeForFolder(filename).replace(/-/g, " ").trim() || "file";
    return `${coursePath}/${sectionPath}/${safeName}`;
};

var detectAuthHtml = (htmlText, responseUrl) => {
    if (responseUrl && /\/login|login\.php/i.test(responseUrl)) {
        return true;
    }
    if (!htmlText || typeof htmlText !== 'string') {
        return false;
    }
    return /name=["']username["']|id=["']login|class=["'][^"']*loginform|course_login_submit/i.test(htmlText);
};

var isOfferedFileType = (type) => {
    const config = FILE_TYPES[type];
    if (!config) {
        return false;
    }
    if (!config.moodleIcon) {
        return type !== 'text';
    }
    if (typeof MOODLE_ICON_MAP === 'undefined') {
        return type !== 'text';
    }
    if (!(config.moodleIcon in MOODLE_ICON_MAP)) {
        return true;
    }
    return MOODLE_ICON_MAP[config.moodleIcon] != null;
};

var matchesFileTypes = (url, fileTypes) => {
    if (!url || !Array.isArray(fileTypes) || fileTypes.length === 0) {
        return false;
    }

    const validExtensions = [];
    fileTypes.forEach((type) => {
        const config = FILE_TYPES[type];
        if (config && config.extensions) {
            validExtensions.push(...config.extensions);
        }
    });

    if (validExtensions.length === 0) {
        return false;
    }

    const lowerUrl = url.toLowerCase();
    const escaped = validExtensions.map((ext) =>
        ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`\\.(${escaped.join('|')})(\\?|$|#)`, 'i');
    return regex.test(lowerUrl);
};

var linkKey = (link) => link.url || `${link.section}::${link.title}`;

if (typeof self !== 'undefined') {
    self.FILE_TYPES = FILE_TYPES;
    self.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
    self.matchesFileTypes = matchesFileTypes;
    self.isOfferedFileType = isOfferedFileType;
    self.sanitizeForFolder = sanitizeForFolder;
    self.getCourseIdFromUrl = getCourseIdFromUrl;
    self.getTypeForUrl = getTypeForUrl;
    self.countByType = countByType;
    self.buildDownloadPath = buildDownloadPath;
    self.detectAuthHtml = detectAuthHtml;
    self.linkKey = linkKey;
}

if (typeof window !== 'undefined') {
    window.FILE_TYPES = FILE_TYPES;
    window.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
    window.matchesFileTypes = matchesFileTypes;
    window.isOfferedFileType = isOfferedFileType;
    window.sanitizeForFolder = sanitizeForFolder;
    window.getCourseIdFromUrl = getCourseIdFromUrl;
    window.getTypeForUrl = getTypeForUrl;
    window.countByType = countByType;
    window.buildDownloadPath = buildDownloadPath;
    window.detectAuthHtml = detectAuthHtml;
    window.linkKey = linkKey;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FILE_TYPES,
        MOODLE_ICON_MAP,
        matchesFileTypes,
        isOfferedFileType,
        sanitizeForFolder,
        getCourseIdFromUrl,
        getTypeForUrl,
        countByType,
        buildDownloadPath,
        detectAuthHtml,
        linkKey
    };
}
