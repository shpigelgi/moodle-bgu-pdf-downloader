try {
  importScripts('utils.js');
} catch (e) {
  console.error('[Background] Failed to import utils.js:', e);
}

const MAX_CONCURRENT_DOWNLOADS = 3;

const sanitizeForFolder = (name) => {
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

const getBasenameFromUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return `file-${Date.now()}`;
  }

  try {
    const parsed = new URL(url);

    // Check for explicit file param first
    const fileParam = parsed.searchParams.get("file");
    if (fileParam) {
      const fileName = fileParam.split("/").filter(Boolean).pop();
      if (fileName) {
        return decodeURIComponent(fileName);
      }
    }

    const pathname = parsed.pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) {
      return decodeURIComponent(last);
    }
  } catch (error) {
    console.error("[Background] Error parsing URL:", error.message);
  }

  return `file-${Date.now()}`;
};

const getFileExtension = (url, title) => {
  // Use centralized FILE_TYPES if available
  const allExtensions = [];
  if (typeof FILE_TYPES !== 'undefined') {
    Object.values(FILE_TYPES).forEach(type => {
      if (type.extensions) allExtensions.push(...type.extensions);
    });
  } else {
    // Fallback if utils not loaded
    allExtensions.push('pdf', 'pptx', 'docx', 'xlsx');
  }

  const extRegex = new RegExp(`\\.(${allExtensions.join('|')})$`, 'i');

  // Try to get extension from URL first
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(extRegex);
    if (match) return match[1].toLowerCase();
  } catch (error) {
    // Ignore URL parsing errors
  }

  // Try to get extension from title
  const titleMatch = title.match(extRegex);
  if (titleMatch) return titleMatch[1].toLowerCase();

  // Default to pdf if unknown
  return 'pdf';
};

const queueDownloads = async (links, courseFolder) => {
  if (!Array.isArray(links) || links.length === 0) {
    console.warn("[Background] No links to download");
    return Promise.resolve();
  }

  const coursePath = sanitizeForFolder(courseFolder || "Moodle Course");
  const titleCounts = {};

  let inFlight = 0;
  let index = 0;

  return new Promise((resolve) => {
    const startNext = () => {
      while (inFlight < MAX_CONCURRENT_DOWNLOADS && index < links.length) {
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

        const sectionPath = sanitizeForFolder(section);

        // Add proper file extension if missing
        const extension = getFileExtension(url, filename);

        let hasExtension = false;
        if (typeof FILE_TYPES !== 'undefined') {
          const allExts = [];
          Object.values(FILE_TYPES).forEach(t => allExts.push(...t.extensions));
          const regex = new RegExp(`\\.(${allExts.join('|')})$`, 'i');
          hasExtension = regex.test(filename);
        } else {
          hasExtension = filename.toLowerCase().match(/\.(pdf|pptx|docx|xlsx)$/);
        }

        if (!hasExtension) {
          filename += `.${extension}`;
        }

        const fullPath = `${coursePath}/${sectionPath}/${filename}`;

        console.log(`[Background] Downloading: ${fullPath}`);

        chrome.downloads.download(
          {
            url: url,
            filename: fullPath,
            conflictAction: "uniquify",
            saveAs: false  // Suppress download prompt, use default Downloads folder
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error(`[Background] Download error:`, chrome.runtime.lastError);
            } else {
              console.log(`[Background] Started download ${downloadId}`);
            }

            inFlight -= 1;
            if (index >= links.length && inFlight === 0) {
              resolve();
            } else {
              startNext();
            }
          }
        );
      }
    };

    if (!links.length) {
      resolve();
      return;
    }

    startNext();
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "download_links") {
    const { links = [], courseTitle = "Moodle Course" } = message;
    if (!Array.isArray(links) || links.length === 0) {
      sendResponse({ ok: false, error: "No files to download" });
      return true;
    }

    queueDownloads(links, courseTitle)
      .then(() => sendResponse({ ok: true, count: links.length }))
      .catch((error) => {
        console.error("[Background] Download queue error:", error);
        sendResponse({ ok: false, error: error.message || "Download failed" });
      });

    return true;
  }

  return false;
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sanitizeForFolder,
    getBasenameFromUrl,
    getFileExtension
  };
}
