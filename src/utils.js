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

// Expose globally if in a module environment or window
if (typeof self !== 'undefined') {
    self.FILE_TYPES = FILE_TYPES;
    self.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
}

if (typeof window !== 'undefined') {
    window.FILE_TYPES = FILE_TYPES;
    window.MOODLE_ICON_MAP = MOODLE_ICON_MAP;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FILE_TYPES,
        MOODLE_ICON_MAP
    };
}
