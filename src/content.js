var getCourseTitle = () =>
  document.querySelector("h1")?.textContent?.trim() || document.title || "Moodle Course";

var getSectionTitle = (element) => {
  // The structure is: li.section.course-section > header + div.content > ul.section > li.activity > a
  // We need to go up from the anchor to the outermost li.section

  const section = element.closest("li.section.course-section");

  if (section) {
    const titleEl = section.querySelector("h3.sectionname");
    if (titleEl) {
      const title = titleEl.textContent.trim();
      if (title) {
        return title;
      }
    }
  }

  return "General";
};

var getResourceTitle = (anchor) => {
  let text = anchor.textContent?.trim();
  if (text && text.length > 0) {
    // Remove Moodle UI labels (Hebrew and English)
    text = text
      .replace(/קובץ\s*/g, '')  // Remove "קובץ" (file in Hebrew)
      .replace(/\s*File$/i, '')  // Remove trailing "File"
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  return anchor.getAttribute("href")?.split("/").pop() || "resource";
};

var looksLikePdf = (url, fileTypes) => {
  if (typeof matchesFileTypes === 'function') {
    return matchesFileTypes(url, fileTypes);
  }

  if (!url || !Array.isArray(fileTypes) || fileTypes.length === 0) {
    return false;
  }

  const lowerUrl = url.toLowerCase();
  const regex = new RegExp(`\\.(${fileTypes.join('|')})(\\?|$|#)`, 'i');
  return regex.test(lowerUrl);
};

var looksLikeMoodleResource = (url) => {
  if (!url) {
    return false;
  }

  return url.includes("/mod/resource/view.php");
};

var collectLinks = async (fileTypes, selectedSections = null) => {
  // Only look for anchors in the main content area, not in the sidebar index
  const mainContent = document.querySelector("#page-content") || document.body;
  const anchors = Array.from(mainContent.querySelectorAll("a[href]"));
  const links = [];
  const seen = new Set();

  console.log('[Content] Collecting links for file types:', fileTypes, 'in sections:', selectedSections || 'ALL');

  // Helper to check if a section should be included
  const shouldIncludeSection = (section) => {
    if (!selectedSections || selectedSections.length === 0) {
      return true; // Include all sections if none specified
    }
    return selectedSections.includes(section);
  };

  // Helper to collect files from folder page
  const collectFromFolder = async (folderUrl, folderName, section) => {
    try {
      console.log(`[Content] Fetching folder:`, folderUrl);
      const response = await fetch(folderUrl, { credentials: 'include' });
      if (!response.ok) {
        console.warn(`[Content] Folder fetch failed (${response.status}):`, folderUrl);
        return [];
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const folderLinks = [];
      const fileLinks = doc.querySelectorAll('a[href*="/pluginfile.php/"]');

      fileLinks.forEach(fileLink => {
        const fileUrl = fileLink.href;
        const fileName = fileLink.textContent.trim();

        const matchesType = looksLikePdf(fileUrl, fileTypes);

        // Skip if doesn't match requested types or if already seen
        if (!matchesType || seen.has(fileUrl)) {
          return;
        }

        seen.add(fileUrl);
        folderLinks.push({
          url: fileUrl,
          section: section,
          title: `${folderName} - ${fileName}`
        });
      });

      console.log(`[Content] Found ${folderLinks.length} files in folder: ${folderName}`);
      return folderLinks;
    } catch (error) {
      console.error(`[Content] Error scanning folder:`, error);
      return [];
    }
  };

  // First pass: collect regular resource links and identify folders
  const foldersToScan = [];

  for (const anchor of anchors) {
    // Skip course index sidebar links
    if (anchor.classList.contains("courseindex-link")) {
      continue;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    let absoluteUrl = href;
    try {
      absoluteUrl = new URL(href, window.location.href).toString();
    } catch (error) {
      // Ignore invalid URLs
      continue;
    }

    // Check if it's a folder
    if (absoluteUrl.includes("/mod/folder/view.php")) {
      const section = getSectionTitle(anchor);
      if (!shouldIncludeSection(section)) {
        continue;
      }

      let folderName = getResourceTitle(anchor);

      // Remove Hebrew "folder view" labels and other common suffixes
      folderName = folderName
        .replace(/תצוגת תיקיית קבצים/g, '')
        .replace(/קובץ/g, '')
        .replace(/File/g, '')
        .trim();

      foldersToScan.push({ url: absoluteUrl, folderName, section });
      continue;
    }

    const isPdf = looksLikePdf(absoluteUrl, fileTypes);
    const isMoodleRes = looksLikeMoodleResource(absoluteUrl);

    if ((isPdf || isMoodleRes) && !seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      const section = getSectionTitle(anchor);
      const title = getResourceTitle(anchor) || "Untitled";

      // Skip if section is not in selected sections
      if (!shouldIncludeSection(section)) {
        console.log(`[Content] Skipping link in section "${section}" (not selected)`);
        continue;
      }

      links.push({ url: absoluteUrl, section, title });
    }
  }

  // Second pass: scan folders with throttling
  if (foldersToScan.length > 0) {
    console.log(`[Content] Scanning ${foldersToScan.length} folders for files...`);

    // Throttled execution
    const CONCURRENCY = 3;
    const results = [];
    let index = 0;

    const scanNext = async () => {
      while (index < foldersToScan.length) {
        const i = index++;
        const f = foldersToScan[i];
        try {
          const folderLinks = await collectFromFolder(f.url, f.folderName, f.section);
          results.push(...folderLinks);
        } catch (e) {
          console.error(`[Content] Error scanning folder ${f.folderName}:`, e);
        }
      }
    };

    const workers = Array(Math.min(foldersToScan.length, CONCURRENCY))
      .fill(null)
      .map(() => scanNext());

    await Promise.all(workers);

    links.push(...results);
  }

  console.log(`[Content] Collected ${links.length} resource link${links.length === 1 ? '' : 's'}`);
  return links;
};

var resolveResourceLink = async (url) => {
  try {
    const response = await fetch(url, { redirect: 'follow', credentials: 'include' });
    const finalUrl = response.url;

    if (!response.ok) {
      const authRequired = response.status === 401 || response.status === 403 || /login/i.test(finalUrl);
      return { urls: [], authRequired };
    }

    if (/login/i.test(finalUrl)) {
      return { urls: [], authRequired: true };
    }

    if (finalUrl.includes("/pluginfile.php/")) {
      return { urls: [finalUrl], authRequired: false };
    }

    const htmlText = await response.text();
    if (typeof detectAuthHtml === 'function' && detectAuthHtml(htmlText, finalUrl)) {
      return { urls: [], authRequired: true };
    }

    const pluginfileRegex = /https?:\/\/[^"'\s]+\/pluginfile\.php\/[^"'\s]+/gi;
    const matches = htmlText.match(pluginfileRegex) || [];
    const results = [...new Set(matches)];

    return { urls: results.length > 0 ? results : [], authRequired: false };
  } catch (error) {
    console.error(`[Content] Error resolving ${url}:`, error.message);
    return { urls: [], authRequired: false };
  }
};

var reportScanProgress = (current, total) => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'scan_progress', current, total }).catch(() => {});
  }
};

var resolveCollectedLinks = async (collectedLinks, fileTypes) => {
  const resolved = [];
  const toResolve = collectedLinks.filter((item) => item.url.includes('/mod/resource/view.php'));
  let resolveIndex = 0;

  for (const item of collectedLinks) {
    const { url, section, title } = item;

    if (url.includes("/pluginfile.php/")) {
      if (looksLikePdf(url, fileTypes)) {
        resolved.push(item);
      }
    } else if (url.includes("/mod/resource/view.php")) {
      const result = await resolveResourceLink(url);
      resolveIndex += 1;
      reportScanProgress(resolveIndex, toResolve.length);

      if (result.authRequired) {
        const err = new Error('Authentication required');
        err.authRequired = true;
        throw err;
      }

      for (const pluginUrl of result.urls) {
        if (looksLikePdf(pluginUrl, fileTypes)) {
          resolved.push({
            url: pluginUrl,
            section,
            title
          });
        }
      }
    }
  }

  return resolved;
};

var getVisibleSection = () => {
  const sections = document.querySelectorAll('li.section.course-section');
  let bestTitle = null;
  let bestVisible = -1;

  sections.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    if (visible > bestVisible) {
      const nameEl = el.querySelector('h3.sectionname');
      const title = nameEl?.textContent?.trim();
      if (title) {
        bestVisible = visible;
        bestTitle = title;
      }
    }
  });

  return bestTitle;
};

var collectSections = () => {
  const sectionList = [];
  const seen = new Set();
  const sectionElements = document.querySelectorAll("li.section.course-section");

  sectionElements.forEach((section) => {
    const sectionName = section.querySelector("h3.sectionname");
    if (!sectionName) return;

    const title = sectionName.textContent.trim();
    if (!title || seen.has(title)) return;

    seen.add(title);
    sectionList.push(title);
  });

  console.log(`[Content] Found ${sectionList.length} section${sectionList.length === 1 ? '' : 's'}`);

  return sectionList;
};

var getAvailableFileTypesInSections = async (selectedSections) => {
  // Map Moodle icon types to file extensions
  // Use global map if available, otherwise fallback
  const iconMap = (typeof MOODLE_ICON_MAP !== 'undefined') ? MOODLE_ICON_MAP : {
    'pdf': 'pdf',
    'powerpoint': 'pptx',
    'document': 'docx',
    'spreadsheet': 'xlsx',
    'text': 'text',
    'archive': null
  };

  const availableTypes = new Set();
  const typeCounts = {};

  // If no sections specified, check all
  const checkAllSections = !selectedSections || selectedSections.length === 0;

  const mainContent = document.querySelector("#page-content") || document.body;

  console.log(`[Content] Scanning for file types. All sections: ${checkAllSections}, Selected:`, selectedSections);

  // Helper function to scan folder contents
  const scanFolder = async (folderUrl) => {
    try {
      console.log(`[Content] Fetching folder:`, folderUrl);
      const response = await fetch(folderUrl, { credentials: 'include' });
      if (!response.ok) {
        console.warn(`[Content] Folder fetch failed (${response.status}):`, folderUrl);
        return new Set();
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const folderTypes = new Set();
      const fileIcons = doc.querySelectorAll('img[src*="/f/"]');

      fileIcons.forEach(img => {
        const match = img.src.match(/\/f\/([^-/]+)/);
        if (match) {
          const moodleType = match[1];
          const fileType = iconMap[moodleType];
          if (fileType) {
            folderTypes.add(fileType);
          }
        }
      });

      console.log(`[Content] Folder contains types:`, Array.from(folderTypes));
      return folderTypes;
    } catch (error) {
      console.error(`[Content] Error scanning folder:`, error);
      return new Set();
    }
  };

  // Collect folders and regular files to scan
  const foldersToScan = [];

  // Find all activity items
  const activityItems = Array.from(mainContent.querySelectorAll(".activity-item"));
  console.log(`[Content] Found ${activityItems.length} activity items`);

  for (const item of activityItems) {
    // Check if this item is in a selected section
    if (!checkAllSections) {
      const sectionTitle = getSectionTitle(item);
      if (!selectedSections.includes(sectionTitle)) {
        console.log(`[Content] Skipping item in section "${sectionTitle}" (not in selected sections)`);
        continue;
      }
    }

    // Check for folder links
    const folderLink = item.querySelector("a[href*='/mod/folder/view.php']");
    if (folderLink) {
      foldersToScan.push(folderLink.href);
      console.log(`[Content] Found folder to scan:`, item.getAttribute('data-activityname'));
      continue;
    }

    // Check for regular file icon
    const iconImg = item.querySelector("img[src*='/f/']");
    if (iconImg) {
      const match = iconImg.src.match(/\/f\/([^-/]+)/);
      if (match) {
        const moodleType = match[1];
        const fileType = iconMap[moodleType];

        if (fileType) {
          availableTypes.add(fileType);
          typeCounts[fileType] = (typeCounts[fileType] || 0) + 1;
          const itemName = item.getAttribute('data-activityname') || '';
          console.log(`[Content] Found ${fileType} (${moodleType}):`, itemName);
        }
      }
    }
  }

  // Scan all folders in parallel
  if (foldersToScan.length > 0) {
    console.log(`[Content] Scanning ${foldersToScan.length} folders...`);
    const folderResults = await Promise.all(foldersToScan.map(scanFolder));
    folderResults.forEach(types => {
      types.forEach(type => {
        availableTypes.add(type);
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    });
  }

  const result = Array.from(availableTypes).sort();
  console.log(`[Content] Final detected file types:`, result);
  return { availableTypes: result, typeCounts };
};

const registerContentMessageListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "collect_sections") {
    const sections = collectSections();
    const courseTitle = document.querySelector("h1")?.textContent.trim() || "Moodle Course";

    sendResponse({
      ok: true,
      sections,
      courseTitle
    });
    return true;
  }

  if (message?.type === "get_available_types") {
    const sections = message.sections || [];

    getAvailableFileTypesInSections(sections).then(({ availableTypes, typeCounts }) => {
      console.log(`[Content] Available types in sections:`, availableTypes);

      sendResponse({
        ok: true,
        availableTypes,
        typeCounts: typeCounts || {}
      });
    }).catch(error => {
      console.error("[Content] Error getting file types:", error);
      sendResponse({
        ok: false,
        availableTypes: [],
        typeCounts: {}
      });
    });

    return true; // Keep channel open for async response
  }

  if (message?.type === "get_visible_section") {
    sendResponse({
      ok: true,
      section: getVisibleSection()
    });
    return true;
  }

  if (message?.type === "collect_links") {
    const fileTypes = Array.isArray(message.fileTypes) && message.fileTypes.length
      ? message.fileTypes
      : ["pdf"];

    const sections = message.sections || null;

    collectLinks(fileTypes, sections).then(collectedLinks => {
      const sectionOrder = collectSections();
      const linkSections = new Set(collectedLinks.map((item) => item.section));
      const allSections = sectionOrder.filter((s) => linkSections.has(s));

      return resolveCollectedLinks(collectedLinks, fileTypes).then((links) => {
        console.log(`[Content] Resolved ${links.length} link${links.length === 1 ? '' : 's'}`);
        sendResponse({
          ok: true,
          links,
          courseTitle: getCourseTitle(),
          sections: allSections
        });
      });
    }).catch(error => {
      console.error("[Content] Error collecting links:", error);
      sendResponse({
        ok: false,
        error: error.message,
        authRequired: Boolean(error.authRequired)
      });
    });

    return true;
  }
  });
};

if (typeof window !== 'undefined' && window.pdfDownloaderContentInjected) {
  console.log("[Content] Script already injected, skipping listener registration.");
} else {
  if (typeof window !== 'undefined') {
    window.pdfDownloaderContentInjected = true;
  }
  registerContentMessageListener();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    looksLikePdf,
    collectSections,
    getAvailableFileTypesInSections,
    getVisibleSection,
    getSectionTitle,
    getResourceTitle
  };
}
