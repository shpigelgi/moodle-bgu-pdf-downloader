// centralized file type definitions
// This file is designed to be loaded:
// 1. In Content Scripts (via manifest.json)
// 2. In Popup (via <script> tag)
// 3. In Background Service Worker (via importScripts)

var FILE_TYPES = {
    'pdf': {
        extensions: ['pdf'],
        label: 'PDF',
        moodleIcon: 'pdf'
    },
    'pptx': {
        extensions: ['pptx', 'ppt'],
        label: 'PowerPoint',
        moodleIcon: 'powerpoint'
    },
    'docx': {
        extensions: ['docx', 'doc'],
        label: 'Word',
        moodleIcon: 'document'
    },
    'xlsx': {
        extensions: ['xlsx', 'xls', 'csv'],
        label: 'Excel',
        moodleIcon: 'spreadsheet'
    },
    // Text files often exported as slightly different things, but we classify them generally
    'text': {
        extensions: ['txt', 'rtf'],
        label: 'Text',
        moodleIcon: 'text'
    }
};

var MOODLE_ICON_MAP = {
    'pdf': 'pdf',
    'powerpoint': 'pptx',
    'document': 'docx',
    'spreadsheet': 'xlsx',
    'text': null, // Generic icon, not a downloadable file type
    'archive': null
};

/** True when url ends with an extension allowed by the selected FILE_TYPES keys (e.g. doc for docx). */
var matchesFileTypes = (url, fileTypes) => {
    if (!url || !Array.isArray(fileTypes) || fileTypes.length === 0) {
        return false;
    }

    const lowerUrl = url.toLowerCase();
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

    const escaped = validExtensions.map((ext) =>
        ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`\\.(${escaped.join('|')})(\\?|$|#)`, 'i');
    return regex.test(lowerUrl);
};

// Expose globally if in a module environment or window
if (typeof self !== 'undefined') {
    self.FILE_TYPES = FILE_TYPES;
    self.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
    self.matchesFileTypes = matchesFileTypes;
}

if (typeof window !== 'undefined') {
    window.FILE_TYPES = FILE_TYPES;
    window.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
    window.matchesFileTypes = matchesFileTypes;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FILE_TYPES,
        MOODLE_ICON_MAP,
        matchesFileTypes
    };
}
