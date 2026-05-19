// Mock chrome API
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    }
};

const { FILE_TYPES, matchesFileTypes } = require('../src/utils');
global.FILE_TYPES = FILE_TYPES;
global.matchesFileTypes = matchesFileTypes;

const fs = require('fs');
const path = require('path');

const {
  looksLikePdf,
  collectSections,
  getAvailableFileTypesInSections,
  getVisibleSection,
  getSectionTitle,
  getResourceTitle,
  collectActivityInventory,
  collectBugReportContext
} = require('../src/content');

// Mock DOM
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

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

    describe('getAvailableFileTypesInSections', () => {
        test('detects PDF and PowerPoint on LLM course fixture', async () => {
            const fixturePath = path.join(
                __dirname,
                '../resources/קורס_ יישומים מתקדמים של מודלי שפה_ הטמעה, התאמה, וסוכנים חכמים סמ 2 _ דף הבית.html'
            );
            const html = fs.readFileSync(fixturePath, 'utf8');
            const { JSDOM } = require('jsdom');
            const dom = new JSDOM(html);
            global.document = dom.window.document;

            const { availableTypes } = await getAvailableFileTypesInSections([]);
            expect(availableTypes).toContain('pdf');
            expect(availableTypes).toContain('pptx');
        });
    });

    describe('collectSections', () => {
        test('preserves course page DOM order (not alphabetical)', () => {
            const fixturePath = path.join(
                __dirname,
                '../resources/קורס_ אבטחת מחשבים ורשתות תקשורת סמ 2 _ דף הבית.html'
            );
            const html = fs.readFileSync(fixturePath, 'utf8');
            const { JSDOM } = require('jsdom');
            const dom = new JSDOM(html);
            global.document = dom.window.document;

            const sections = collectSections();
            expect(sections.length).toBeGreaterThan(2);
            expect(sections[0]).toBe('מבוא');
            expect(sections[1]).toBe('מצגות הרצאות');
            expect(sections[2]).toBe('תרגולים');

            const sorted = [...sections].sort((a, b) => a.localeCompare(b, 'he'));
            expect(sections).not.toEqual(sorted);
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

    describe('bug report context', () => {
        test('collectActivityInventory lists sections and activities on LLM fixture', () => {
            const fixturePath = path.join(
                __dirname,
                '../resources/קורס_ יישומים מתקדמים של מודלי שפה_ הטמעה, התאמה, וסוכנים חכמים סמ 2 _ דף הבית.html'
            );
            const html = fs.readFileSync(fixturePath, 'utf8');
            const { JSDOM } = require('jsdom');
            const dom = new JSDOM(html);
            global.document = dom.window.document;

            const inventory = collectActivityInventory();
            expect(inventory.length).toBeGreaterThan(0);
            const withPdf = inventory.find((s) =>
                s.activities.some((a) => a.type === 'pdf' || a.type === 'resource')
            );
            expect(withPdf).toBeTruthy();
        });

        test('collectBugReportContext includes sanitized HTML', () => {
            const fixturePath = path.join(
                __dirname,
                '../resources/קורס_ אבטחת מחשבים ורשתות תקשורת סמ 2 _ דף הבית.html'
            );
            const html = fs.readFileSync(fixturePath, 'utf8');
            const { JSDOM } = require('jsdom');
            const dom = new JSDOM(html);
            global.document = dom.window.document;

            const ctx = collectBugReportContext();
            expect(ctx.ok).toBe(true);
            expect(ctx.sectionInventory.length).toBeGreaterThan(0);
            expect(ctx.pageHtml.length).toBeGreaterThan(100);
            expect(ctx.pageHtml).not.toMatch(/<script/i);
            expect(ctx.domStats.activityItems).toBeGreaterThan(0);
        });
    });
});
