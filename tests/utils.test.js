const { FILE_TYPES, MOODLE_ICON_MAP } = require('../src/utils');

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

    describe('MOODLE_ICON_MAP', () => {
        test('should map moodle icons to file keys', () => {
            expect(MOODLE_ICON_MAP).toBeDefined();
            expect(MOODLE_ICON_MAP.pdf).toBe('pdf');
            expect(MOODLE_ICON_MAP.powerpoint).toBe('pptx');
            expect(MOODLE_ICON_MAP.document).toBe('docx');
            expect(MOODLE_ICON_MAP.spreadsheet).toBe('xlsx');
        });

        test('should map text to docx', () => {
            expect(MOODLE_ICON_MAP.text).toBe('docx');
        });

        test('should return null for archive', () => {
            expect(MOODLE_ICON_MAP.archive).toBeNull();
        });
    });
});
