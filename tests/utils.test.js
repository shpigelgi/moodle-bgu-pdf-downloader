const { FILE_TYPES, MOODLE_ICON_MAP, matchesFileTypes, isOfferedFileType } = require('../src/utils');

describe('utils.js', () => {
    describe('FILE_TYPES', () => {
        test('should have defined file types', () => {
            expect(FILE_TYPES).toBeDefined();
            expect(FILE_TYPES.pdf).toBeDefined();
            expect(FILE_TYPES.pptx).toBeDefined();
            expect(FILE_TYPES.docx).toBeDefined();
            expect(FILE_TYPES.xlsx).toBeDefined();
        });

        test('should have correct extensions for PDF', () => {
            expect(FILE_TYPES.pdf.extensions).toContain('pdf');
        });

        test('should have correct extensions for PowerPoint', () => {
            expect(FILE_TYPES.pptx.extensions).toContain('pptx');
            expect(FILE_TYPES.pptx.extensions).toContain('ppt');
        });
    });

    describe('isOfferedFileType', () => {
        test('offers pptx/docx/xlsx via moodleIcon keys, not FILE_TYPES keys', () => {
            expect(isOfferedFileType('pdf')).toBe(true);
            expect(isOfferedFileType('pptx')).toBe(true);
            expect(isOfferedFileType('docx')).toBe(true);
            expect(isOfferedFileType('xlsx')).toBe(true);
        });

        test('excludes text when moodle maps text to null', () => {
            expect(isOfferedFileType('text')).toBe(false);
        });
    });

    describe('matchesFileTypes', () => {
        test('matches alias extensions (doc for docx type)', () => {
            expect(matchesFileTypes('http://x/file.doc', ['docx'])).toBe(true);
            expect(matchesFileTypes('http://x/file.docx', ['docx'])).toBe(true);
        });

        test('matches ppt when pptx type selected', () => {
            expect(matchesFileTypes('http://x/slides.ppt', ['pptx'])).toBe(true);
        });

        test('rejects unrelated extensions', () => {
            expect(matchesFileTypes('http://x/file.txt', ['pdf'])).toBe(false);
        });

        test('handles query strings and fragments', () => {
            expect(matchesFileTypes('http://x/a.pdf?forcedownload=1', ['pdf'])).toBe(true);
            expect(matchesFileTypes('http://x/a.pdf#section', ['pdf'])).toBe(true);
        });

        test('returns false for empty input', () => {
            expect(matchesFileTypes(null, ['pdf'])).toBe(false);
            expect(matchesFileTypes('http://x/a.pdf', [])).toBe(false);
        });
    });

    describe('MOODLE_ICON_MAP', () => {
        test('should map moodle icons to file keys', () => {
            expect(MOODLE_ICON_MAP).toBeDefined();
            expect(MOODLE_ICON_MAP.pdf).toBe('pdf');
            expect(MOODLE_ICON_MAP.spreadsheet).toBe('xlsx');
        });

        test('should map text to null (generic icon)', () => {
            expect(MOODLE_ICON_MAP.text).toBeNull();
        });

        test('should return null for archive', () => {
            expect(MOODLE_ICON_MAP.archive).toBeNull();
        });
    });
});
