// Mock chrome API
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        }
    },
    downloads: {
        download: jest.fn()
    }
};

const { sanitizeForFolder, getBasenameFromUrl, getFileExtension } = require('../src/background');
// Mock FILE_TYPES globally for testing
global.FILE_TYPES = {
    pdf: { extensions: ['pdf'] },
    pptx: { extensions: ['pptx', 'ppt'] },
    docx: { extensions: ['docx', 'doc'] },
    xlsx: { extensions: ['xlsx', 'xls'] }
};

describe('background.js', () => {
    describe('sanitizeForFolder', () => {
        test('should replace illegal characters with hyphen', () => {
            expect(sanitizeForFolder('File/Name:Test')).toBe('File-Name-Test');
            expect(sanitizeForFolder('File\\Name')).toBe('File-Name');
            expect(sanitizeForFolder('File*Name')).toBe('File-Name');
        });

        test('should trim whitespace', () => {
            expect(sanitizeForFolder('  File Name  ')).toBe('File Name');
        });

        test('should return "Unknown" for empty or invalid input', () => {
            expect(sanitizeForFolder('')).toBe('Unknown');
            expect(sanitizeForFolder(null)).toBe('Unknown');
            expect(sanitizeForFolder(undefined)).toBe('Unknown');
        });

        test('should truncate long names', () => {
            const longName = 'a'.repeat(100);
            expect(sanitizeForFolder(longName).length).toBe(80);
        });
    });

    describe('getBasenameFromUrl', () => {
        test('should extract filename from simple URL', () => {
            expect(getBasenameFromUrl('http://example.com/file.pdf')).toBe('file.pdf');
        });

        test('should extract filename from URL with query params', () => {
            expect(getBasenameFromUrl('http://example.com/file.pdf?id=123')).toBe('file.pdf');
        });

        test('should extract filename from "file" query param', () => {
            expect(getBasenameFromUrl('http://example.com/view.php?file=/path/to/test.pdf')).toBe('test.pdf');
        });

        test('should return default name for empty URL', () => {
            const name = getBasenameFromUrl('');
            expect(name).toMatch(/^file-\d+$/);
        });

        test('should decode URI components', () => {
            expect(getBasenameFromUrl('http://example.com/My%20File.pdf')).toBe('My File.pdf');
        });
    });

    describe('getFileExtension', () => {
        test('should extract extension from URL', () => {
            expect(getFileExtension('http://example.com/file.pdf', 'My File')).toBe('pdf');
            expect(getFileExtension('http://example.com/file.docx', 'My File')).toBe('docx');
        });

        test('should extract extension from Title if URL fails', () => {
            expect(getFileExtension('http://example.com/view.php', 'My File.pptx')).toBe('pptx');
        });

        test('should default to pdf if unknown', () => {
            expect(getFileExtension('http://example.com/file', 'My File')).toBe('pdf');
        });

        test('should support multiple extensions for same type', () => {
            expect(getFileExtension('http://example.com/file.ppt', 'Presentation')).toBe('ppt');
        });
    });
});
