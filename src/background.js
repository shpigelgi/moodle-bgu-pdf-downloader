if (typeof importScripts === 'function') {
  try {
    importScripts('utils.js');
  } catch (e) {
    console.error('[Background] Failed to import utils.js:', e);
  }
}

const MAX_CONCURRENT_DOWNLOADS = 3;
let cancelRequested = false;
let activeDownloadIds = [];

const getBasenameFromUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return `file-${Date.now()}`;
  }

  try {
    const parsed = new URL(url);
    const fileParam = parsed.searchParams.get('file');
    if (fileParam) {
      const fileName = fileParam.split('/').filter(Boolean).pop();
      if (fileName) return decodeURIComponent(fileName);
    }
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    if (last && last.includes('.')) return decodeURIComponent(last);
  } catch (error) {
    console.error('[Background] Error parsing URL:', error.message);
  }

  return `file-${Date.now()}`;
};

const getFileExtension = (url, title) => {
  const allExtensions = [];
  if (typeof FILE_TYPES !== 'undefined') {
    Object.values(FILE_TYPES).forEach((type) => {
      if (type.extensions) allExtensions.push(...type.extensions);
    });
  } else {
    allExtensions.push('pdf', 'pptx', 'docx', 'xlsx');
  }

  const extRegex = new RegExp(`\\.(${allExtensions.join('|')})$`, 'i');

  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(extRegex);
    if (match) return match[1].toLowerCase();
  } catch (error) {
    // ignore
  }

  const titleMatch = title.match(extRegex);
  if (titleMatch) return titleMatch[1].toLowerCase();
  return 'pdf';
};

const reportDownloadProgress = (completed, total) => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'download_progress', completed, total }).catch(() => {});
  }
};

const queueDownloads = async (links, courseFolder, filenamePrefix = '') => {
  if (!Array.isArray(links) || links.length === 0) {
    return { succeeded: 0, failed: 0, failures: [], cancelled: false };
  }

  cancelRequested = false;
  activeDownloadIds = [];

  const sanitize = typeof sanitizeForFolder === 'function' ? sanitizeForFolder : (n) => n || 'Unknown';
  const coursePath = sanitize(courseFolder || 'Moodle Course');
  const prefix = sanitize(filenamePrefix).replace(/\s+/g, '_');
  const titleCounts = {};
  const failures = [];
  let succeeded = 0;
  let failed = 0;
  let completed = 0;
  const total = links.length;

  let inFlight = 0;
  let index = 0;

  return new Promise((resolve) => {
    const finish = () => {
      resolve({
        succeeded,
        failed,
        failures,
        cancelled: cancelRequested,
        count: succeeded
      });
    };

    const startNext = () => {
      if (cancelRequested) {
        activeDownloadIds.forEach((id) => {
          try {
            chrome.downloads.cancel(id);
          } catch (e) {
            // ignore
          }
        });
        if (inFlight === 0) finish();
        return;
      }

      while (inFlight < MAX_CONCURRENT_DOWNLOADS && index < links.length && !cancelRequested) {
        const item = links[index++];
        const { url, section, title } = item;
        inFlight += 1;

        let filename = title;
        const key = `${section}/${title}`;
        if (titleCounts[key]) {
          filename = `${title} (${++titleCounts[key]})`;
        } else {
          titleCounts[key] = 0;
        }

        if (prefix) {
          filename = `${prefix}${filename}`;
        }

        const sectionPath = sanitize(section);
        const extension = getFileExtension(url, filename);

        let hasExtension = false;
        if (typeof FILE_TYPES !== 'undefined') {
          const allExts = [];
          Object.values(FILE_TYPES).forEach((t) => allExts.push(...t.extensions));
          const regex = new RegExp(`\\.(${allExts.join('|')})$`, 'i');
          hasExtension = regex.test(filename);
        } else {
          hasExtension = /\.(pdf|pptx|docx|xlsx)$/i.test(filename);
        }

        if (!hasExtension) {
          filename += `.${extension}`;
        }

        const fullPath = `${coursePath}/${sectionPath}/${filename}`;

        chrome.downloads.download(
          {
            url,
            filename: fullPath,
            conflictAction: 'uniquify',
            saveAs: false
          },
          (downloadId) => {
            completed += 1;
            reportDownloadProgress(completed, total);

            if (chrome.runtime.lastError) {
              failed += 1;
              failures.push({ title, error: chrome.runtime.lastError.message || 'Download failed' });
            } else if (downloadId) {
              succeeded += 1;
              activeDownloadIds.push(downloadId);
            } else {
              failed += 1;
              failures.push({ title, error: 'No download id' });
            }

            inFlight -= 1;
            if ((index >= links.length && inFlight === 0) || (cancelRequested && inFlight === 0)) {
              finish();
            } else {
              startNext();
            }
          }
        );
      }
    };

    startNext();
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'download_links') {
    const { links = [], courseTitle = 'Moodle Course', filenamePrefix = '' } = message;
    if (!Array.isArray(links) || links.length === 0) {
      sendResponse({ ok: false, error: 'No files to download' });
      return true;
    }

    queueDownloads(links, courseTitle, filenamePrefix)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => {
        console.error('[Background] Download queue error:', error);
        sendResponse({ ok: false, error: error.message || 'Download failed' });
      });

    return true;
  }

  if (message?.type === 'cancel_downloads') {
    cancelRequested = true;
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'show_downloads_folder') {
    if (chrome.downloads.showDefaultFolder) {
      chrome.downloads.showDefaultFolder();
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'Not supported' });
    }
    return true;
  }

  return false;
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getBasenameFromUrl,
    getFileExtension,
    queueDownloads
  };
}
