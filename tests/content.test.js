// Mock chrome API
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    }
};

const { looksLikePdf, getSectionTitle, getResourceTitle } = require('../src/content');

// Mock DOM
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

// Mock FILE_TYPES globally
global.FILE_TYPES = {
    pdf: { extensions: ['pdf'] },
    pptx: { extensions: ['pptx'] },
    docx: { extensions: ['docx', 'doc'] },
    xlsx: { extensions: ['xlsx', 'xls'] }
};

describe('content.js', () => {
    describe('looksLikePdf (Renamed to check any file type)', () => {
        test('should return true for PDF url', () => {
            expect(looksLikePdf('http://example.com/file.pdf', ['pdf'])).toBe(true);
        });

        test('should return true for PPTX url when checking for pptx', () => {
            expect(looksLikePdf('http://example.com/file.pptx', ['pptx'])).toBe(true);
        });

        test('should match multiple extensions (doc/docx)', () => {
            expect(looksLikePdf('http://example.com/file.doc', ['docx'])).toBe(true);
            expect(looksLikePdf('http://example.com/file.docx', ['docx'])).toBe(true);
        });

        test('should return false for unmatched extension', () => {
            expect(looksLikePdf('http://example.com/file.txt', ['pdf'])).toBe(false);
        });

        test('should return false for invalid URL', () => {
            expect(looksLikePdf(null, ['pdf'])).toBe(false);
        });
    });

    describe('getResourceTitle', () => {
        test('should extract clean title from anchor text', () => {
            const anchor = document.createElement('a');
            anchor.textContent = 'My File Name File';
            expect(getResourceTitle(anchor)).toBe('My File Name');
        });

        test('should remove Hebrew "File" prefix', () => {
            const anchor = document.createElement('a');
            anchor.textContent = 'קובץ Assignment Instructions';
            expect(getResourceTitle(anchor)).toBe('Assignment Instructions');
        });

        test('should fallback to filename from href if text is empty', () => {
            const anchor = document.createElement('a');
            anchor.href = 'http://example.com/resource/Lecture1.pdf';
            anchor.textContent = '';
            expect(getResourceTitle(anchor)).toBe('Lecture1.pdf');
        });
    });

    describe('getSectionTitle', () => {
        test('should find section title from parent elements', () => {
            // Setup DOM structure: li.section > h3.sectionname
            const li = document.createElement('li');
            li.className = 'section course-section';

            const h3 = document.createElement('h3');
            h3.className = 'sectionname';
            h3.textContent = 'Week 1';

            const contentDiv = document.createElement('div');
            const anchor = document.createElement('a');

            li.appendChild(h3);
            li.appendChild(contentDiv);
            contentDiv.appendChild(anchor);

            expect(getSectionTitle(anchor)).toBe('Week 1');
        });

        test('should return "General" if no section found', () => {
            const anchor = document.createElement('a');
            document.body.appendChild(anchor);
            expect(getSectionTitle(anchor)).toBe('General');
        });
    });
});
